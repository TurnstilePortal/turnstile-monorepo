// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.24;

import "forge-std/Test.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IMinimalAztecRegistry} from "../src/interfaces/IMinimalAztecRegistry.sol";
import {Hash} from "@aztec/core/libraries/crypto/Hash.sol";

import {TokenPortal} from "../src/TokenPortal.sol";
import {ERC20TokenPortal} from "../src/ERC20TokenPortal.sol";
import {ERC20AllowList} from "../src/ERC20AllowList.sol";
import {InsecurePortalTestToken} from "./InsecurePortalTestToken.sol";

// test harness so we can call internal functions
contract ERC20TokenPortalHarness is ERC20TokenPortal {
    constructor(IMinimalAztecRegistry _aztecRegistry, ERC20AllowList _allowList, address _l2PortalInitializer)
        ERC20TokenPortal(_aztecRegistry, _allowList, _l2PortalInitializer)
    {}

    function exposed_decodeDeposit(bytes calldata _data) external returns (address, bytes32) {
        return _decodeDeposit(_data);
    }

    function exposed_decodeWithdraw(bytes calldata _data) external returns (address, bytes32) {
        return _decodeWithdraw(_data);
    }

    function exposed_tokenRegistrationContentHash(address _token) external view returns (bytes32) {
        return _tokenRegistrationContentHash(_token);
    }

    function exposed_depositTransfer(address _token) external {
        _depositTransfer(_token);
    }

    function exposed_withdrawTransfer(address _token) external {
        _withdrawTransfer(_token);
    }

    function _sendL2Message(bytes32 _contentHash) internal override returns (bytes32 key, uint256 index) {
        // Do nothing
    }
}

contract ERC20TokenPortalTest is Test {
    ERC20AllowList allowList;
    ERC20TokenPortalHarness tokenPortal;
    InsecurePortalTestToken token;

    // 2^253 - 1
    uint256 public constant DEPOSIT_LIMIT = 0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    address admin;
    address approver;

    function setUp() public {
        admin = makeAddr("admin");
        approver = makeAddr("approver");

        allowList = new ERC20AllowList(admin, approver);
        tokenPortal = new ERC20TokenPortalHarness(
            IMinimalAztecRegistry(address(0)), // aztec registry
            allowList,
            address(this) // l2 portal initializer
        );

        tokenPortal.setL2Portal(bytes32(uint256(0x123456789abcdef))); // set a dummy L2 portal

        // register a token
        token = new InsecurePortalTestToken();
        allowList.propose(address(token));
        vm.prank(approver);
        allowList.accept(address(token));

        tokenPortal.register(address(token));
    }

    function test_decodeDeposit() public {
        bytes32 recipient = bytes32(uint256(0x123456789abcdef));
        bytes memory data = abi.encodeWithSignature("deposit(address,bytes32,uint256)", address(token), recipient, 100);

        (address decodedToken, bytes32 contentHash) = tokenPortal.exposed_decodeDeposit(data);

        assertEq(decodedToken, address(token));
        assertEq(contentHash, Hash.sha256ToField(data));

        // check the decode flag is set
        vm.expectRevert(abi.encodeWithSelector(ERC20TokenPortal.ERC20TokenPortal__DataAlreadyDecoded.selector));
        tokenPortal.exposed_decodeDeposit(data);
    }

    function test_decodeWithdraw() public {
        bytes32 recipient = bytes32(uint256(0x123456789abcdef));
        bytes memory data = abi.encodeWithSignature("withdraw(address,address,uint256)", address(token), recipient, 100);

        (address decodedToken, bytes32 contentHash) = tokenPortal.exposed_decodeWithdraw(data);

        assertEq(decodedToken, address(token));
        assertEq(contentHash, Hash.sha256ToField(data));

        // check the decode flag is set
        vm.expectRevert(abi.encodeWithSelector(ERC20TokenPortal.ERC20TokenPortal__DataAlreadyDecoded.selector));
        tokenPortal.exposed_decodeWithdraw(data);
    }

    function test_tokenRegistrationContentHash() public view {
        bytes32 contentHash = tokenPortal.exposed_tokenRegistrationContentHash(address(token));

        assertEq(
            contentHash,
            Hash.sha256ToField(
                abi.encodeWithSignature(
                    "register(address,string,string,uint8)",
                    address(token),
                    token.name(),
                    token.symbol(),
                    token.decimals()
                )
            )
        );
    }

    function test_depositTransfer() public {
        address depositor = makeAddr("depositor");
        token.mint(depositor, 100 ether);

        vm.startPrank(depositor);
        token.approve(address(tokenPortal), 100 ether);

        bytes32 recipient = bytes32(uint256(0x123456789abcdef));
        bytes memory data =
            abi.encodeWithSignature("deposit(address,bytes32,uint256)", address(token), recipient, 100 ether);

        // must call _decodeDeposit before _depositTransfer
        vm.expectRevert(abi.encodeWithSelector(ERC20TokenPortal.ERC20TokenPortal__DataNotDecoded.selector));
        tokenPortal.exposed_depositTransfer(address(token));

        // decode the data
        tokenPortal.exposed_decodeDeposit(data);

        // transfer the tokens
        tokenPortal.exposed_depositTransfer(address(token));

        // check the token balances
        assertEq(token.balanceOf(address(depositor)), 0);

        assertEq(token.balanceOf(address(tokenPortal)), 100 ether);

        vm.stopPrank();
    }

    function test_depositTransfer_RevertWhen_DepositLimitExceeded() public {
        address depositor = makeAddr("depositor");
        token.mint(depositor, type(uint256).max);

        bytes32 recipient = bytes32(uint256(0x123456789abcdef));

        // deposit DEPOSIT_LIMIT + 1 tokens
        bytes memory data =
            abi.encodeWithSignature("deposit(address,bytes32,uint256)", address(token), recipient, DEPOSIT_LIMIT + 1);

        vm.startPrank(depositor);
        token.approve(address(tokenPortal), type(uint256).max);
        tokenPortal.exposed_decodeDeposit(data);

        vm.expectRevert(abi.encodeWithSelector(ERC20TokenPortal.ERC20TokenPortal__DepositLimitExceeded.selector));
        tokenPortal.exposed_depositTransfer(address(token));
    }

    function test_withdrawTransfer() public {
        address recipient = makeAddr("recipient");
        token.mint(address(tokenPortal), 100 ether);

        bytes memory data =
            abi.encodeWithSignature("withdraw(address,address,uint256)", address(token), recipient, 100 ether);

        // must call _decodeWithdraw before _withdrawTransfer
        vm.expectRevert(abi.encodeWithSelector(ERC20TokenPortal.ERC20TokenPortal__DataNotDecoded.selector));
        tokenPortal.exposed_withdrawTransfer(address(token));

        // decode the data
        tokenPortal.exposed_decodeWithdraw(data);

        // transfer the tokens
        tokenPortal.exposed_withdrawTransfer(address(token));

        // check the token balances
        assertEq(token.balanceOf(address(tokenPortal)), 0);

        assertEq(token.balanceOf(address(recipient)), 100 ether);
    }
}
