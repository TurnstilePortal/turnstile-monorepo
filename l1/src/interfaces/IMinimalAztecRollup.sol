// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.24;

import {IMinimalAztecInbox} from "./IMinimalAztecInbox.sol";
import {IMinimalAztecOutbox} from "./IMinimalAztecOutbox.sol";

interface IMinimalAztecRollup {
    /* solhint-disable func-name-mixedcase */
    function INBOX() external view returns (IMinimalAztecInbox);
    function OUTBOX() external view returns (IMinimalAztecOutbox);
    /* solhint-enable func-name-mixedcase */
}
