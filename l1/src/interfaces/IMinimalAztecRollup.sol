// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.24;

import {IMinimalAztecInbox} from "./IMinimalAztecInbox.sol";
import {IMinimalAztecOutbox} from "./IMinimalAztecOutbox.sol";

interface IMinimalAztecRollup {
    function getInbox() external view returns (IMinimalAztecInbox);
    function getOutbox() external view returns (IMinimalAztecOutbox);
}
