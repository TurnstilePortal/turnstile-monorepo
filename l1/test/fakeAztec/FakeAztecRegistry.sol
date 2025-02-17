// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.24;

import {IMinimalAztecRegistry} from "../../src/interfaces/IMinimalAztecRegistry.sol";
import {IMinimalAztecRollup} from "../../src/interfaces/IMinimalAztecRollup.sol";

contract FakeAztecRegistry is IMinimalAztecRegistry {
    IMinimalAztecRollup public rollup;

    constructor(IMinimalAztecRollup _rollup) {
        rollup = _rollup;
    }

    function getRollup() external view override returns (IMinimalAztecRollup) {
        return rollup;
    }
}
