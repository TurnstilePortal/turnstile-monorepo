// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.19;

import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";
import {IMinimalAztecOutbox} from "../../src/interfaces/IMinimalAztecOutbox.sol";

contract FakeAztecOutbox is IMinimalAztecOutbox {
    function consume(
        DataStructures.L2ToL1Msg calldata _message,
        uint256 _l2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external {
        // Do nothing
    }
}
