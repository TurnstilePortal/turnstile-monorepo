// SPDX-License-Identifier: Apache-2.0

pragma solidity >=0.8.0;

import {InsecureMintableToken} from "./InsecureMintableToken.sol";

contract InsecurePortalTestToken is InsecureMintableToken {
    constructor() InsecureMintableToken("InsecurePortal Test Token", "IPTT", 18) {}
}
