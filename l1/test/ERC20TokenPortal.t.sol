// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.27;

import {Test} from "forge-std/Test.sol";

import {Hash} from "@aztec/core/libraries/crypto/Hash.sol";
import {IRegistry} from "@aztec/governance/interfaces/IRegistry.sol";

import {ERC20AllowList} from "../src/ERC20AllowList.sol";
import {ERC20TokenPortal} from "../src/ERC20TokenPortal.sol";
import {InsecurePortalTestToken} from "./InsecurePortalTestToken.sol";

// test harness so we can call internal functions
contract ERC20TokenPortalHarness is ERC20TokenPortal {
    constructor(IRegistry _aztecRegistry, ERC20AllowList _allowList, address _l2PortalInitializer)
        ERC20TokenPortal(_aztecRegistry, _allowList, _l2PortalInitializer)
    {}

    function exposed_decodeDeposit(bytes calldata _data) external pure returns (address, bytes32, uint256) {
        return _decodeDeposit(_data);
    }

    function exposed_decodeWithdraw(bytes calldata _data) external pure returns (address, bytes32, address, uint256) {
        return _decodeWithdraw(_data);
    }

    function exposed_tokenRegistrationContentHash(address _token) external view returns (bytes32) {
        return _tokenRegistrationContentHash(_token);
    }

    function exposed_depositTransfer(address _token, uint256 _amount) external {
        _depositTransfer(_token, _amount);
    }

    function exposed_withdrawTransfer(address _token, address _recipient, uint256 _amount) external {
        _withdrawTransfer(_token, _recipient, _amount);
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
            IRegistry(address(0)), // aztec registry
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

    function test_decodeDeposit() public view {
        bytes32 recipient = bytes32(uint256(0x123456789abcdef));
        uint256 amount = 100;
        bytes memory data =
            abi.encodeWithSignature("deposit(address,bytes32,uint256)", address(token), recipient, amount);

        (address decodedToken, bytes32 contentHash, uint256 decodedAmount) = tokenPortal.exposed_decodeDeposit(data);

        assertEq(decodedToken, address(token));
        assertEq(contentHash, Hash.sha256ToField(data));
        assertEq(decodedAmount, amount);
    }

    function test_decodeWithdraw() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 100;
        bytes memory data =
            abi.encodeWithSignature("withdraw(address,address,uint256)", address(token), recipient, amount);

        (address decodedToken, bytes32 contentHash, address decodedRecipient, uint256 decodedAmount) =
            tokenPortal.exposed_decodeWithdraw(data);

        assertEq(decodedToken, address(token));
        assertEq(contentHash, Hash.sha256ToField(data));
        assertEq(decodedRecipient, recipient);
        assertEq(decodedAmount, amount);
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
        uint256 amount = 100 ether;
        token.mint(depositor, amount);

        vm.startPrank(depositor);
        token.approve(address(tokenPortal), amount);

        // transfer the tokens
        tokenPortal.exposed_depositTransfer(address(token), amount);

        // check the token balances
        assertEq(token.balanceOf(address(depositor)), 0);
        assertEq(token.balanceOf(address(tokenPortal)), amount);

        vm.stopPrank();
    }

    function test_depositTransfer_RevertWhen_DepositLimitExceeded() public {
        address depositor = makeAddr("depositor");
        token.mint(depositor, type(uint256).max);

        uint256 amount = DEPOSIT_LIMIT + 1;

        vm.startPrank(depositor);
        token.approve(address(tokenPortal), type(uint256).max);

        vm.expectRevert(abi.encodeWithSelector(ERC20TokenPortal.ERC20TokenPortal__DepositLimitExceeded.selector));
        tokenPortal.exposed_depositTransfer(address(token), amount);
    }

    function test_withdrawTransfer() public {
        address recipient = makeAddr("recipient");
        uint256 amount = 100 ether;
        token.mint(address(tokenPortal), amount);

        // transfer the tokens
        tokenPortal.exposed_withdrawTransfer(address(token), recipient, amount);

        // check the token balances
        assertEq(token.balanceOf(address(tokenPortal)), 0);
        assertEq(token.balanceOf(address(recipient)), amount);
    }
}
