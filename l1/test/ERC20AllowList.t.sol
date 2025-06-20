// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.27;

import "forge-std/Test.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IAllowList} from "../src/interfaces/IAllowList.sol";
import {IERC20Minimal} from "../src/interfaces/IERC20Minimal.sol";

import {ERC20AllowList} from "../src/ERC20AllowList.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {InsecurePortalTestToken} from "./InsecurePortalTestToken.sol";

contract ERC20AllowListTest is Test {
    address admin;
    address approver;

    ERC20AllowList allowList;

    function setUp() public {
        admin = makeAddr("admin");
        approver = makeAddr("approver");

        allowList = new ERC20AllowList(admin, approver);
    }

    function test_checkProposalSuccess() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_ZeroAddress() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.ZERO_ADDRESS
            )
        );

        allowList.checkProposal(address(0));
    }

    function test_checkProposal_RevertWhen_Name() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(IERC20Minimal.name.selector),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.NAME
            )
        );

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_Symbol() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(IERC20Minimal.symbol.selector),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.SYMBOL
            )
        );

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_Decimals() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(IERC20Minimal.decimals.selector),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.DECIMALS
            )
        );

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_TotalSupply() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(IERC20.totalSupply.selector),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.TOTAL_SUPPLY
            )
        );

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_BalanceOf() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(IERC20.balanceOf.selector, address(0)),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.BALANCE_OF
            )
        );

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_Approve() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(
                IERC20.approve.selector,
                address(allowList),
                0
            ),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.APPROVE
            )
        );

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_TransferFrom() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(
                IERC20.transferFrom.selector,
                address(allowList),
                address(allowList),
                0
            ),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.TRANSFER_FROM
            )
        );

        allowList.checkProposal(address(token));
    }

    function test_checkProposal_RevertWhen_Transfer() public {
        InsecurePortalTestToken token = new InsecurePortalTestToken();
        vm.mockCallRevert(
            address(token),
            abi.encodeWithSelector(
                IERC20.transfer.selector,
                address(allowList),
                0
            ),
            "mocked"
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ERC20AllowList.ERC20AllowList__InvalidToken.selector,
                ERC20AllowList.ErrorCode.TRANSFER
            )
        );

        allowList.checkProposal(address(token));
    }
}
