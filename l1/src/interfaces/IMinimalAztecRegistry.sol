// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.18;

import {IMinimalAztecRollup} from "./IMinimalAztecRollup.sol";

interface IMinimalAztecRegistry {
    function getRollup() external view returns (IMinimalAztecRollup);
}
