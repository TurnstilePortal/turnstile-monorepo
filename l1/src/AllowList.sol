/// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {IAllowList} from "./interfaces/IAllowList.sol";

/// Allow List
abstract contract AllowList is IAllowList, AccessControl {
    /// Role for approving allow list proposals
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    /// Mapping of addresses -> allow list status
    mapping(address => Status) public status;
    /// List of approved addresses to enable easy enumeration
    address[] public allowList;

    modifier onlyUnknown(address _addr) {
        _onlyStatus(_addr, Status.UNKNOWN);
        _;
    }

    modifier onlyProposed(address _addr) {
        _onlyStatus(_addr, Status.PROPOSED);
        _;
    }

    /// @param _admin address to use for `DEFAULT_ADMIN_ROLE`
    /// @param _approver address to use for `APPROVER_ROLE`
    constructor(address _admin, address _approver) {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(APPROVER_ROLE, _approver);
    }

    /// @inheritdoc IAllowList
    /// @dev virtual so type-specific allow lists can enforce policy on proposals
    function propose(address _addr) external onlyUnknown(_addr) {
        checkProposal(_addr);
        _setStatus(_addr, Status.PROPOSED);
        allowList.push(_addr);
    }

    /// @inheritdoc IAllowList
    function checkProposal(address _addr) public virtual;

    /// @inheritdoc IAllowList
    /// @param _addr Address to accept
    function accept(address _addr) external onlyRole(APPROVER_ROLE) onlyProposed(_addr) {
        _setStatus(_addr, Status.ACCEPTED);
    }

    /// @inheritdoc IAllowList
    /// @notice Only callable by `APPROVER_ROLE`
    function reject(address _addr) external onlyRole(APPROVER_ROLE) onlyProposed(_addr) {
        _setStatus(_addr, Status.REJECTED);
    }

    /// @inheritdoc IAllowList
    function allowed(address _addr) external view returns (bool) {
        return status[_addr] == Status.ACCEPTED;
    }

    /// @inheritdoc IAllowList
    function allowed() external view returns (address[] memory) {
        return allowList;
    }

    /// @inheritdoc IAllowList
    function allowedLen() external view returns (uint256) {
        return allowList.length;
    }

    /// Set the status of an address and log it
    /// @param _addr Address to update
    /// @param _status Status to set it to
    function _setStatus(address _addr, Status _status) internal {
        emit StatusUpdated(_addr, uint8(_status), uint8(status[_addr]));
        status[_addr] = _status;
    }

    /// Check if the address has the specified status, and reverts with `AllowList__BadStatus`
    /// error if it does not.
    /// This is a helpfer function for the `onlyUnknown` and `onlyProposed` modifiers.
    /// @param _addr Address to check
    /// @param _status Desired status
    function _onlyStatus(address _addr, Status _status) internal view {
        if (status[_addr] != _status) {
            revert AllowList__BadStatus(_addr, uint8(status[_addr]), uint8(_status));
        }
    }
}
