// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// Interface for the minimal ERC20 standard that Turnstile supports.
interface IERC20Minimal is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}
