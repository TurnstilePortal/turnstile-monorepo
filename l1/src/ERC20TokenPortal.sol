// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMinimalAztecRegistry} from "./interfaces/IMinimalAztecRegistry.sol";
import {IMinimalAztecRollup} from "./interfaces/IMinimalAztecRollup.sol";
import {IMinimalAztecInbox} from "./interfaces/IMinimalAztecInbox.sol";
import {IMinimalAztecOutbox} from "./interfaces/IMinimalAztecOutbox.sol";
import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";
import {Hash} from "@aztec/core/libraries/crypto/Hash.sol";

import {IAllowList} from "./interfaces/IAllowList.sol";
import {ITokenPortal} from "./interfaces/ITokenPortal.sol";
import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";

contract ERC20TokenPortal is ITokenPortal {
    using SafeERC20 for IERC20Minimal;

    /// @dev Max 253 bit uint: 2^253 - 1
    uint256 public constant DEPOSIT_LIMIT = 0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    string public constant REGISTER_SIGNATURE = "register(address,string,string,uint8)";
    bytes4 public constant DEPOSIT_SELECTOR = bytes4(keccak256("deposit(address,bytes32,uint256)"));
    bytes4 public constant WITHDRAW_SELECTOR = bytes4(keccak256("withdraw(address,address,uint256)"));

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

    error ERC20TokenPortal__InvalidTransactionType();
    error ERC20TokenPortal__InvalidData();
    error ERC20TokenPortal__InvalidSignature();
    error ERC20TokenPortal__DepositLimitExceeded();
    error ERC20TokenPortal__NameTooLong();
    error ERC20TokenPortal__SymbolTooLong();

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

    /// @param _aztecRegistry the L1 Aztec Rollup Registry
    /// @param _allowList token allow list
    constructor(IMinimalAztecRegistry _aztecRegistry, IAllowList _allowList, address _l2PortalInitializer) {
        L2_PORTAL_INITIALIZER = _l2PortalInitializer;

        AZTEC_REGISTRY = IMinimalAztecRegistry(_aztecRegistry);
        emit SetAztecRegistry(address(_aztecRegistry));

        ALLOW_LIST = _allowList;
        emit SetAllowList(address(_allowList));
    }

    /// @inheritdoc ITokenPortal
    function setL2Portal(bytes32 _l2Portal) external override {
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
    function register(address _token) external override requireL2Portal returns (bytes32 leaf, uint256 index) {
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
    function propose(address _token) external override {
        ALLOW_LIST.propose(_token);
    }

    /// @inheritdoc ITokenPortal
    function deposit(bytes calldata _data) external override requireL2Portal returns (bytes32 leaf, uint256 index) {
        // Decode the message
        (address token, bytes32 contentHash, uint256 amount) = _decodeDeposit(_data);

        // Require token is registered
        if (!tokenRegistry[token]) {
            revert TokenPortal__NotRegistered(token);
        }

        // Transfer tokens to us
        _depositTransfer(token, amount);

        // Send the message to L2
        (leaf, index) = _sendL2Message(contentHash);

        emit Deposit(token, msg.sender, leaf, index);
    }

    /// @inheritdoc ITokenPortal
    function withdraw(bytes calldata _data, uint256 _l2BlockNumber, uint256 _leafIndex, bytes32[] calldata _path)
        external
        override
        requireL2Portal
    {
        // Decode the message
        (address token, bytes32 contentHash, address recipient, uint256 amount) = _decodeWithdraw(_data);

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
        _withdrawTransfer(token, recipient, amount);
    }

    /// Send a message to the L2 Portal using `PUBLIC_NOT_SECRET_HASH` for the secret hash.
    /// @param _contentHash the content hash of the message
    /// @return leaf The hash of the entry in the Inbox
    /// @return index The global index of the entry in the Inbox
    function _sendL2Message(bytes32 _contentHash) internal virtual returns (bytes32 leaf, uint256 index) {
        DataStructures.L2Actor memory actor = DataStructures.L2Actor(l2Portal, 1);

        (leaf, index) = aztecInbox().sendL2Message(actor, _contentHash, PUBLIC_NOT_SECRET_HASH);
    }

    /// Returns the content hash of the message to be sent to L2 when a token is registered.
    /// @param tokenAddr token address
    /// @return the content hash of the message
    function _tokenRegistrationContentHash(address tokenAddr) internal view returns (bytes32) {
        IERC20Minimal token = IERC20Minimal(tokenAddr);

        // Limit the name and symbol to 31 characters to fit within a Field
        string memory name = token.name();
        if (bytes(name).length > 31) {
            revert ERC20TokenPortal__NameTooLong();
        }
        string memory symbol = token.symbol();
        if (bytes(symbol).length > 31) {
            revert ERC20TokenPortal__SymbolTooLong();
        }

        return
            Hash.sha256ToField(abi.encodeWithSignature(REGISTER_SIGNATURE, tokenAddr, name, symbol, token.decimals()));
    }

    /// Decode the deposit data from the message
    /// @param data the deposit message
    /// @return token the token address
    /// @return contentHash the content hash of the message
    /// @return amount the amount to deposit
    function _decodeDeposit(bytes calldata data)
        internal
        pure
        returns (address token, bytes32 contentHash, uint256 amount)
    {
        // Ensure the data is the expected length
        // 4 (selector) + 32 (token) + 32 (recipient) + 32 (amount) = 100
        if (data.length != 100) {
            revert ERC20TokenPortal__InvalidData();
        }

        // decode the selector
        bytes4 sig = bytes4(data[:4]);
        if (sig != DEPOSIT_SELECTOR) {
            revert ERC20TokenPortal__InvalidSignature();
        }

        // decode the rest of the data
        bytes32 recipient;
        (token, recipient, amount) = abi.decode(data[4:], (address, bytes32, uint256));

        // Calculate the content hash
        contentHash = Hash.sha256ToField(data);
    }

    /// Transfer tokens from the sender to the portal
    /// @param token the token address
    /// @param amount the amount to transfer
    function _depositTransfer(address token, uint256 amount) internal {
        if (IERC20Minimal(token).balanceOf(address(this)) + amount > DEPOSIT_LIMIT) {
            revert ERC20TokenPortal__DepositLimitExceeded();
        }

        IERC20Minimal(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// Decode the withdraw data from the message
    /// @param data the withdraw message
    /// @return token the token address
    /// @return contentHash the content hash of the message
    /// @return recipient the recipient address
    /// @return amount the amount to withdraw
    function _decodeWithdraw(bytes calldata data)
        internal
        pure
        returns (address token, bytes32 contentHash, address recipient, uint256 amount)
    {
        // Ensure the data is the expected length
        // 4 (selector) + 32 (token) + 32 (recipient) + 32 (amount) = 100
        if (data.length != 100) {
            revert ERC20TokenPortal__InvalidData();
        }

        // decode the selector
        bytes4 sig = bytes4(data[:4]);
        if (sig != WITHDRAW_SELECTOR) {
            revert ERC20TokenPortal__InvalidSignature();
        }

        // decode the rest of the data
        (token, recipient, amount) = abi.decode(data[4:], (address, address, uint256));

        // Calculate the content hash
        contentHash = Hash.sha256ToField(data);
    }

    function _withdrawTransfer(address token, address recipient, uint256 amount) internal {
        IERC20Minimal(token).safeTransfer(recipient, amount);
    }
}
