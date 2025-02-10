// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.28;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMinimalAztecRegistry} from "./interfaces/IMinimalAztecRegistry.sol";
import {Hash} from "@aztec/core/libraries/crypto/Hash.sol";

import {TokenPortal} from "./TokenPortal.sol";
import {ERC20AllowList} from "./ERC20AllowList.sol";

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";

contract ERC20TokenPortal is TokenPortal {
    using SafeERC20 for IERC20Minimal;

    error ERC20TokenPortal__InvalidTransactionType();
    error ERC20TokenPortal__InvalidData();
    error ERC20TokenPortal__InvalidSignature();
    error ERC20TokenPortal__DataNotDecoded();
    error ERC20TokenPortal__DataAlreadyDecoded();
    error ERC20TokenPortal__DepositLimitExceeded();
    error ERC20TokenPortal__NameTooLong();
    error ERC20TokenPortal__SymbolTooLong();

    /// @dev Max 253 bit uint: 2^253 - 1
    uint256 public constant DEPOSIT_LIMIT = 0x1fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    string public constant REGISTER_SIGNATURE = "register(address,string,string,uint8)";
    bytes4 public constant DEPOSIT_SELECTOR = bytes4(keccak256("deposit(address,bytes32,uint256)"));
    bytes4 public constant WITHDRAW_SELECTOR = bytes4(keccak256("withdraw(address,address,uint256)"));

    bytes32 internal constant _DECODE_DEPOSIT_FLAG = keccak256("DECODE_DEPOSIT_FLAG");
    bytes32 internal constant _DECODE_WITHDRAW_FLAG = keccak256("DECODE_WITHDRAW_FLAG");

    bool transient transientDecodeFlag;
    address transient transientRecipient;
    uint256 transient transientAmount;


    /// @param aztecRegistry the L1 Aztec Rollup Registry
    /// @param allowList token allow list
    constructor(IMinimalAztecRegistry aztecRegistry, ERC20AllowList allowList, address l2PortalInitializer)
        TokenPortal(aztecRegistry, allowList, l2PortalInitializer)
    {}

    /// Ensure the decode flag is not set, and then set it after the function runs
    /// @param flag the flag to set
    modifier decodeFlag(bytes32 flag) {
        // ensure the flag is not already set
        if (transientDecodeFlag) {
            revert ERC20TokenPortal__DataAlreadyDecoded();
        }

        // run the function
        _;

        // set the flag
        transientDecodeFlag = true;
    }

    /// Check that the decoded data flag has been set to `flag`
    /// @param flag the flag to check
    modifier onlyDecoded(bytes32 flag) {
        if (!transientDecodeFlag) {
            revert ERC20TokenPortal__DataNotDecoded();
        }
        _;
    }

    /// @inheritdoc TokenPortal
    function _tokenRegistrationContentHash(address tokenAddr) internal view override returns (bytes32) {
        IERC20Minimal token = IERC20Minimal(tokenAddr);

        // Limit the name and symbol to 31 characters to fit within a Field
        // TODO(twt): do we need to support tokens with longer names/symbols?
        string memory name = token.name();
        if (bytes(name).length > 31) {
            revert ERC20TokenPortal__NameTooLong();
        }
        string memory symbol = token.symbol();
        if (bytes(symbol).length > 31) {
            revert ERC20TokenPortal__SymbolTooLong();
        }

        return Hash.sha256ToField(
            abi.encodeWithSignature(REGISTER_SIGNATURE, tokenAddr, name, symbol, token.decimals())
        );
    }

    /// @inheritdoc TokenPortal
    /// @dev `data` should be `abi.encodeWithSignature("deposit(address,bytes32,uint256)", token, l2Recipient, amount)`
    function _decodeDeposit(bytes calldata data)
        internal
        override
        decodeFlag(_DECODE_DEPOSIT_FLAG)
        returns (address token, bytes32 contentHash)
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
        uint256 amount;
        (token, recipient, amount) = abi.decode(data[4:], (address, bytes32, uint256));

        // Store the amount in transient storage for use in _depositTransfer()
        transientAmount = amount;
        // We are not storing the token address because we're passing it back to the caller, which makes it
        // cheaper to just pass it back than to store/load it from transient storage

        // Calculate the content hash.
        // We just decoded and validated the data, so we don't need to re-encode it,
        // contentHash = Hash.sha256ToField(abi.encodeWithSignature("deposit(address,bytes32,uint256)", token, recipient, amount));
        contentHash = Hash.sha256ToField(data);
    }

    /// @inheritdoc TokenPortal
    function _depositTransfer(address token) internal override onlyDecoded(_DECODE_DEPOSIT_FLAG) {
        uint256 amount = transientAmount;

        if (IERC20Minimal(token).balanceOf(address(this)) + amount > DEPOSIT_LIMIT) {
            revert ERC20TokenPortal__DepositLimitExceeded();
        }

        IERC20Minimal(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc TokenPortal
    /// @dev `data` should be `abi.encodeWithSignature("withdraw(address,address,uint256)", token, l1Recipient, amount)`
    function _decodeWithdraw(bytes calldata data)
        internal
        override
        decodeFlag(_DECODE_WITHDRAW_FLAG)
        returns (address token, bytes32 contentHash)
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
        address recipient;
        uint256 amount;
        (token, recipient, amount) = abi.decode(data[4:], (address, address, uint256));

        // Store the recipient, and amount in transient storage for use in _withdrawTransfer()
        transientRecipient = recipient;
        transientAmount = amount;

        // Calculate the content hash.
        // We just decoded and validated the data, so we don't need to re-encode it,
        // contentHash = Hash.sha256ToField(abi.encodeWithSignature("withdraw(address,address,uint256)", token, recipient, amount));
        contentHash = Hash.sha256ToField(data);
    }

    /// @inheritdoc TokenPortal
    function _withdrawTransfer(address _token) internal override onlyDecoded(_DECODE_WITHDRAW_FLAG) {
        address recipient = transientRecipient;
        uint256 amount = transientAmount;

        IERC20Minimal(_token).safeTransfer(recipient, amount);
    }
}
