// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.18;

import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";

interface IMinimalAztecInbox {
    function sendL2Message(DataStructures.L2Actor memory _recipient, bytes32 _content, bytes32 _secretHash)
        external
        returns (bytes32, uint256);
}
