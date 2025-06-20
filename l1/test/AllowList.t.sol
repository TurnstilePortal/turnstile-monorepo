// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.27;

import "forge-std/Test.sol";

import {IAllowList} from "../src/interfaces/IAllowList.sol";
import {AllowList} from "../src/AllowList.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

// concrete contract for testing AllowList
contract testAllowList is AllowList {
    constructor(
        address _admin,
        address _approver
    ) AllowList(_admin, _approver) {}

    function checkProposal(address _addr) public pure override {
        require(_addr != address(0), "AllowList: zero address");
    }
}

contract AllowListTest is Test {
    address admin;
    address approver;

    AllowList allowList;

    function setUp() public {
        admin = makeAddr("admin");
        approver = makeAddr("approver");

        allowList = new testAllowList(admin, approver);
    }

    function test_ProposeSuccess() public {
        address propose = makeAddr("propose");
        allowList.propose(propose);
        assertEq(uint8(allowList.status(propose)), 1 /* Status.PROPOSED */);
        assertFalse(allowList.allowed(propose));
    }

    function test_RevertWhen_ProposeDuplicate() public {
        address propose = makeAddr("propose");
        allowList.propose(propose);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAllowList.AllowList__BadStatus.selector,
                propose,
                1,
                /* Status.PROPOSED*/
                0 /* Wanted Status.UNKNOWN */
            )
        );
        allowList.propose(propose);
    }

    function test_AcceptSuccess() public {
        address propose = makeAddr("propose");
        allowList.propose(propose);
        vm.prank(approver);
        allowList.accept(propose);
        assertEq(uint8(allowList.status(propose)), 2 /* Status.ACCEPTED */);
        assertTrue(allowList.allowed(propose));
        assertEq(allowList.allowedLen(), 1);
        assertEq(allowList.allowed()[0], propose);
    }

    function test_RevertWhen_AcceptInvalidApprover() public {
        address propose = makeAddr("propose");
        allowList.propose(propose);
        address notApprover = makeAddr("notApprover");
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                notApprover /* address of unauthorized account */,
                keccak256("APPROVER_ROLE") /* required role */
            )
        );
        vm.prank(notApprover);
        allowList.accept(propose);
    }

    function test_RejectSuccess() public {
        address propose = makeAddr("propose");
        allowList.propose(propose);
        vm.prank(approver);
        allowList.reject(propose);
        assertEq(uint8(allowList.status(propose)), 3 /* Status.REJECTED */);
    }

    function test_RevertWhen_RejectInvalidApprover() public {
        address propose = makeAddr("propose");
        allowList.propose(propose);
        address notApprover = makeAddr("notApprover");
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                notApprover /* address of unauthorized account */,
                keccak256("APPROVER_ROLE") /* required role */
            )
        );
        vm.prank(notApprover);
        allowList.reject(propose);
    }
}
