// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.24;

import {DataStructures} from "@aztec/core/libraries/DataStructures.sol";
import {IMinimalAztecInbox} from "../../src/interfaces/IMinimalAztecInbox.sol";

contract FakeAztecInbox is IMinimalAztecInbox {
    function sendL2Message(DataStructures.L2Actor memory _recipient, bytes32 _content, bytes32 _secretHash)
        external
        returns (bytes32 key, uint256 index)
    {
        // Do nothing
    }
}
