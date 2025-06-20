// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.27;

import {IAllowList} from "./IAllowList.sol";
import {IInbox} from "@aztec/core/interfaces/messagebridge/IInbox.sol";
import {IOutbox} from "@aztec/core/interfaces/messagebridge/IOutbox.sol";
import {IRollup} from "@aztec/core/interfaces/IRollup.sol";
import {IRegistry} from "@aztec/governance/interfaces/IRegistry.sol";

interface ITokenPortal {
    /// Emitted when the Aztec Rollup Registry is set.
    event SetAztecRegistry(address registry);
    /// Emitted when the L2 Portal address is set.
    event SetL2Portal(bytes32 l2Portal);
    /// Emitted when the AllowList address is set.
    event SetAllowList(address allowList);
    /// Emitted when a new token is registered with the portal.
    event Registered(address indexed token, bytes32 leaf, uint256 index);
    /// Emitted when a token is deposited into the portal.
    event Deposit(
        address indexed token,
        address indexed sender,
        bytes32 leaf,
        uint256 index
    );

    /// Error when attempting to use an unregistered token
    error TokenPortal__NotRegistered(address);

    /// Error when attempting to registered a token that isn't permitted
    /// by the allow list
    error TokenPortal__NotPermitted(address);

    /// Error when attempting to register a token that is already registered
    error TokenPortal__AlreadyRegistered(address);

    /// Error when attempting to use the portal without a paired L2 bridge
    error TokenPortal__NoL2Portal();

    /// Error when attempting to set a zero address
    error TokenPortal__ZeroAddress();

    /// Error when attempting to initialize a parameter that has already been set
    error TokenPortal__AlreadySet();

    /// Error when attempting to initialize a parameter without authorization
    error TokenPortal__Unauthorized();

    /// The Aztec Rollup Registry
    function aztecRegistry() external view returns (IRegistry);

    // The Aztec Rollup contract
    function aztecRollup() external view returns (IRollup);

    /// The Aztec Rollup Inbox
    function aztecInbox() external view returns (IInbox);

    /// The Aztec Rollup Outbox
    function aztecOutbox() external view returns (IOutbox);

    /// The paired L2 Portal address
    function l2Portal() external view returns (bytes32);

    /// The token allow list
    function allowList() external view returns (IAllowList);

    /// The token registry
    function tokenRegistry(address) external view returns (bool);

    /// Register a token with the portal. The token must be in the allow list and must
    /// not have been previously registered.
    /// @param _token address of the token
    /// @return leaf The hash of the entry in the Inbox
    /// @return index The global index of the entry in the Inbox
    function register(
        address _token
    ) external returns (bytes32 leaf, uint256 index);

    /// Propose a token to be registered with the portal.
    /// @param _token address of the token
    function propose(address _token) external;

    /// Check if a token is registered with the portal
    /// @param _token address of the token
    function registered(address _token) external view returns (bool);

    /// Deposit tokens into the portal
    /// @param _data encoded deposit message
    /// @return leaf The hash of the entry in the Inbox
    /// @return index The global index of the entry in the Inbox
    function deposit(
        bytes calldata _data
    ) external returns (bytes32 leaf, uint256 index);

    /// Withdraw tokens from the portal
    /// @param _data encoded withdraw message
    /// @param _l2BlockNumber the L2 block number
    /// @param _leafIndex the leaf index
    /// @param _path the path to the leaf
    function withdraw(
        bytes calldata _data,
        uint256 _l2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external;

    /// Set the L2 Portal address. This can only be called by the deployer and is only callable once.
    /// @param _l2Portal the paired Aztec L2 Portal contract address
    function setL2Portal(bytes32 _l2Portal) external;
}
