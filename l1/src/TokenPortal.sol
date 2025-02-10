// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.19;

// Messaging
import {IMinimalAztecRegistry} from "./interfaces/IMinimalAztecRegistry.sol";
import {IMinimalAztecRollup} from "./interfaces/IMinimalAztecRollup.sol";
import {IMinimalAztecInbox} from "./interfaces/IMinimalAztecInbox.sol";
import {IMinimalAztecOutbox} from "./interfaces/IMinimalAztecOutbox.sol";
import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";

import {IAllowList} from "./interfaces/IAllowList.sol";
import {ITokenPortal} from "./interfaces/ITokenPortal.sol";

/// Turnstile token portal base contract
/// @dev This contract is the base for all token portals and implements the basic functionality
/// of registering tokens with the portal and sending messages to the L2 bridge.
/// To create a new token portal, inherit from this contract and implement the following functions:
/// - `_tokenRegistrationContentHash()`: function to define the content hash of the message to be sent to L2 when a token is registered
/// - `deposit()`: function to deposit tokens into the portal
/// - `withdraw()`: function to withdraw tokens from the portal
abstract contract TokenPortal is ITokenPortal {
    /// @inheritdoc ITokenPortal
    bytes32 public l2Portal;

    /// @inheritdoc ITokenPortal
    mapping(address => bool) public tokenRegistry;

    /// @dev Used once to set the L2 Portal address post-deployment.
    address public immutable L2_PORTAL_INITIALIZER;

    IMinimalAztecRegistry public immutable AZTEC_REGISTRY;
    IAllowList public immutable ALLOW_LIST;

    /// Hash of the string "public" used to send messages to L2. Computed with `computeSecretHash()` from aztec.js
    /// computeSecretHash(Buffer.from("public").toString("hex")) = 0x08c95e8336028903a8b24af616b13aaf6ebea60cd17b4947e514e3600a797081
    bytes32 public constant PUBLIC_NOT_SECRET_HASH = 0x08c95e8336028903a8b24af616b13aaf6ebea60cd17b4947e514e3600a797081;

    /// @param _aztecRegistry the L1 Aztec Rollup Registry
    /// @param _allowList token allow list
    constructor(IMinimalAztecRegistry _aztecRegistry, IAllowList _allowList, address _l2PortalInitializer) {
        L2_PORTAL_INITIALIZER = _l2PortalInitializer;

        AZTEC_REGISTRY = IMinimalAztecRegistry(_aztecRegistry);
        emit SetAztecRegistry(address(_aztecRegistry));

        ALLOW_LIST = _allowList;
        emit SetAllowList(address(_allowList));
    }

    modifier requireL2Portal() {
        if (l2Portal == bytes32(0)) {
            revert TokenPortal__NoL2Portal();
        }
        _;
    }

    modifier onlyRegistered(address _token) {
        if (!tokenRegistry[_token]) {
            revert TokenPortal__NotRegistered(_token);
        }
        _;
    }

    /// @inheritdoc ITokenPortal
    function setL2Portal(bytes32 _l2Portal) external {
        // Ensure the caller is the l2PortalInitializer
        if (msg.sender != L2_PORTAL_INITIALIZER) {
            revert TokenPortal__Unauthorized();
        }

        // Ensure the L2 Portal is not the zero address
        if (_l2Portal == bytes32(0)) {
            revert TokenPortal__ZeroAddress();
        }

        // Ensure the L2 Portal has not already been set
        if (l2Portal != bytes32(0)) {
            revert TokenPortal__AlreadySet();
        }

        l2Portal = _l2Portal;
        emit SetL2Portal(_l2Portal);
    }

    /// @inheritdoc ITokenPortal
    function allowList() external view override returns (IAllowList) {
        return ALLOW_LIST;
    }

    /// @inheritdoc ITokenPortal
    function aztecRegistry() external view override returns (IMinimalAztecRegistry) {
        return AZTEC_REGISTRY;
    }

    /// @inheritdoc ITokenPortal
    function aztecRollup() external view override returns (IMinimalAztecRollup) {
        return AZTEC_REGISTRY.getRollup();
    }

    /// @inheritdoc ITokenPortal
    function aztecInbox() public view override returns (IMinimalAztecInbox) {
        return AZTEC_REGISTRY.getRollup().INBOX();
    }

    /// @inheritdoc ITokenPortal
    function aztecOutbox() public view override returns (IMinimalAztecOutbox) {
        return AZTEC_REGISTRY.getRollup().OUTBOX();
    }

    /// @inheritdoc ITokenPortal
    /// @dev you need to implement `_tokenRegistrationContentHash()` to define the content hash of the message
    function register(address _token) external requireL2Portal returns (bytes32 leaf, uint256 index) {
        if (tokenRegistry[_token]) {
            revert TokenPortal__AlreadyRegistered(_token);
        }

        if (!ALLOW_LIST.allowed(_token)) {
            revert TokenPortal__NotPermitted(_token);
        }

        bytes32 contentHash = _tokenRegistrationContentHash(_token);

        tokenRegistry[_token] = true;
        (leaf, index) = _sendL2Message(contentHash);
        emit Registered(_token, leaf, index);
    }

    /// @inheritdoc ITokenPortal
    function registered(address _token) external view override returns (bool) {
        return tokenRegistry[_token];
    }

    /// @inheritdoc ITokenPortal
    /// @dev this is just a helper to call `ALLOW_LIST.propose()`
    function propose(address _token) external {
        ALLOW_LIST.propose(_token);
    }

    /// @inheritdoc ITokenPortal
    /// @dev This function calls `_decodeDeposit()` followed by `_depositTransfer()` which must be implemented by the inheriting contract
    function deposit(bytes calldata _data) external requireL2Portal returns (bytes32 leaf, uint256 index) {
        // Decode the message
        (address token, bytes32 contentHash) = _decodeDeposit(_data);

        // Require token is registered
        if (!tokenRegistry[token]) {
            revert TokenPortal__NotRegistered(token);
        }

        // Transfer tokens to us
        _depositTransfer(token);

        // Send the message to L2
        (leaf, index) = _sendL2Message(contentHash);

        emit Deposit(token, msg.sender, leaf, index);
    }

    /// @inheritdoc ITokenPortal
    /// @dev This function calls `_decodeWithdraw()` followed by `_withdrawTransfer()` which must be implemented by the inheriting contract
    function withdraw(bytes calldata _data, uint256 _l2BlockNumber, uint256 _leafIndex, bytes32[] calldata _path)
        external
        requireL2Portal
    {
        // Decode the message
        (address token, bytes32 contentHash) = _decodeWithdraw(_data);

        // Require token is registered
        if (!tokenRegistry[token]) {
            revert TokenPortal__NotRegistered(token);
        }

        // Verify & consume the message
        DataStructures.L2ToL1Msg memory message = DataStructures.L2ToL1Msg({
            sender: DataStructures.L2Actor(l2Portal, 1),
            recipient: DataStructures.L1Actor(address(this), block.chainid),
            content: contentHash
        });

        aztecOutbox().consume(message, _l2BlockNumber, _leafIndex, _path);

        // transfer tokens to recipient
        _withdrawTransfer(token);
    }

    /// Send a message to the L2 Portal using `PUBLIC_NOT_SECRET_HASH` for the secret hash.
    /// @param _contentHash the content hash of the message
    /// @return leaf The hash of the entry in the Inbox
    /// @return index The global index of the entry in the Inbox
    /// @dev this function is virtual so it can be overridden in tests
    function _sendL2Message(bytes32 _contentHash) internal virtual returns (bytes32 leaf, uint256 index) {
        DataStructures.L2Actor memory actor = DataStructures.L2Actor(l2Portal, 1);

        (leaf, index) = aztecInbox().sendL2Message(actor, _contentHash, PUBLIC_NOT_SECRET_HASH);
    }

    /// Returns the content hash of the message to be sent to L2 when a token is registered.
    /// @param _token token address
    /// @return _contentHash the content hash of the message
    function _tokenRegistrationContentHash(address _token) internal virtual returns (bytes32 _contentHash);

    /// Decode the deposit data from the message
    /// @param _data the deposit message
    /// @return _token the token address
    /// @return _contentHash the content hash of the message
    function _decodeDeposit(bytes calldata _data) internal virtual returns (address _token, bytes32 _contentHash);

    /// Transfer tokens from the sender to the portal
    /// @param _token the token address
    function _depositTransfer(address _token) internal virtual;

    /// Decode the withdraw data from the message
    /// @param _data the withdraw message
    /// @return _token the token address
    /// @return _contentHash the content hash of the message
    function _decodeWithdraw(bytes calldata _data) internal virtual returns (address _token, bytes32 _contentHash);

    /// Transfer tokens from the portal to the recipient
    /// @param _token the token address
    function _withdrawTransfer(address _token) internal virtual;
}
