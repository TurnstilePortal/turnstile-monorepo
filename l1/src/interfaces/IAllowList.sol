/// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.24;

interface IAllowList {
    /// Allow list statuses
    enum Status {
        UNKNOWN,
        PROPOSED,
        ACCEPTED,
        REJECTED
    }

    /// Allow list status updated
    /// @param addr target address
    /// @param status the current status (`AllowList.Status`)
    /// @param prev the previous status
    event StatusUpdated(
        address indexed addr,
        uint8 indexed status,
        uint8 indexed prev
    );

    /// Error when attempting to change an allow list status.
    /// @param addr target address
    /// @param status the current status (`AllowList.Status`)
    /// @param wanted the desired status
    error AllowList__BadStatus(address addr, uint8 status, uint8 wanted);

    /// Check if an address has been accepted in the allow list
    /// @param _addr address to check
    function allowed(address _addr) external returns (bool);

    /// Returns an array of all addresses in the allow list
    function allowed() external returns (address[] memory);

    /// Returns the number of addresses in the allow list
    function allowedLen() external returns (uint256);

    /// Propose an address for the allow list
    /// @param _addr address to propose
    function propose(address _addr) external;

    /// Check a proposed address to ensure it meets the allow list requirements
    /// @param _addr address to check
    function checkProposal(address _addr) external;

    /// Accept a proposed address
    /// @param _addr address to accept
    function accept(address _addr) external;

    /// Reject a proposed address
    /// @param _addr address to reject
    function reject(address _addr) external;

    /// Returns true if the address is an approver
    /// @param _addr address to check
    function isApprover(address _addr) external returns (bool);
}
