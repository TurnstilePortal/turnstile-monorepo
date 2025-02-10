// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.18;

import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";

interface IMinimalAztecOutbox {
    function consume(
        DataStructures.L2ToL1Msg calldata _message,
        uint256 _l2BlockNumber,
        uint256 _leafIndex,
        bytes32[] calldata _path
    ) external;
}
