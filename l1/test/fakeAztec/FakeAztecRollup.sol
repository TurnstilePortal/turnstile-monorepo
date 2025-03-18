// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.24;

import {IMinimalAztecRollup} from "../../src/interfaces/IMinimalAztecRollup.sol";
import {IMinimalAztecInbox} from "../../src/interfaces/IMinimalAztecInbox.sol";
import {IMinimalAztecOutbox} from "../../src/interfaces/IMinimalAztecOutbox.sol";

contract FakeAztecRollup is IMinimalAztecRollup {
    IMinimalAztecInbox public inbox;
    IMinimalAztecOutbox public outbox;

    constructor(IMinimalAztecInbox _inbox, IMinimalAztecOutbox _outbox) {
        inbox = _inbox;
        outbox = _outbox;
    }

    function getInbox() external view override returns (IMinimalAztecInbox) {
        return inbox;
    }

    function getOutbox() external view override returns (IMinimalAztecOutbox) {
        return outbox;
    }
}
