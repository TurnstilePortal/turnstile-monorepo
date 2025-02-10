// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.19;

import {IERC20Minimal} from "./interfaces/IERC20Minimal.sol";
import {AllowList} from "./AllowList.sol";

contract ERC20AllowList is AllowList {
    /// Error when a token does not meet the minimum ERC20 requirements
    error ERC20AllowList__InvalidToken(ErrorCode code);

    /// Error codes for ERC20 validation
    enum ErrorCode {
        ZERO_ADDRESS, // zero address
        NAME, // name() unsupported
        SYMBOL, // symbol() unsupported
        DECIMALS, // decimals() unsupported
        TOTAL_SUPPLY, // totalSupply() unsupported
        BALANCE_OF, // balanceOf() unsupported
        APPROVE, // approve() unsupported
        TRANSFER, // transfer() unsupported
        TRANSFER_FROM // transferFrom() unsupported

    }

    /// @param _admin address to use for `DEFAULT_ADMIN_ROLE`. This address can manage `APPROVER_ROLE`.
    /// @param _approver address to use for `APPROVER_ROLE`
    constructor(address _admin, address _approver) AllowList(_admin, _approver) {
        // solhint-disable-previous-line no-empty-blocks
    }

    /// Sanity checks to ensure tokens meet our minimal ERC20 standard.
    /// Some of these methods are optional per the official spec, but
    /// we're considering them required.
    /// Reverts if any checks fails with a message about which check
    /// TODO: figure out if this is reliable enough or if it breaks on some tokens
    /// @inheritdoc AllowList
    function checkProposal(address _token) public override {
        if (_token == address(0)) {
            revert ERC20AllowList__InvalidToken(ErrorCode.ZERO_ADDRESS);
        }

        // Attempt to call each function and check for success
        try IERC20Minimal(_token).name() returns (string memory) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.NAME);
        }

        try IERC20Minimal(_token).symbol() returns (string memory) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.SYMBOL);
        }

        try IERC20Minimal(_token).decimals() returns (uint8) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.DECIMALS);
        }

        try IERC20Minimal(_token).totalSupply() returns (uint256) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.TOTAL_SUPPLY);
        }

        try IERC20Minimal(_token).balanceOf(address(0)) returns (uint256) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.BALANCE_OF);
        }

        try IERC20Minimal(_token).approve(address(this), 0) returns (bool) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.APPROVE);
        }

        try IERC20Minimal(_token).transferFrom(address(this), address(this), 0) returns (bool) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.TRANSFER_FROM);
        }

        try IERC20Minimal(_token).transfer(address(this), 0) returns (bool) {
            // solhint-disable-previous-line no-empty-blocks
        } catch {
            revert ERC20AllowList__InvalidToken(ErrorCode.TRANSFER);
        }
    }
}
