// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/Vm.sol";
import "forge-std/console.sol";

import {DevScript} from "./DevScript.s.sol";
import {TokenPortal} from "../../src/TokenPortal.sol";
import {ITokenPortal} from "../../src/interfaces/ITokenPortal.sol";

// This script sets the L2 portal address for an L1 portal contract
// Usage: forge script script/dev/SetL2PortalAddress.s.sol --sig "run(address,bytes32)" 0xLayer1PortalAddress 0xLayer2PortalAddress
contract SetL2PortalAddress is DevScript {
    function run(address l1Portal, bytes32 l2Portal) external {
        vm.startBroadcast(deployerPrivateKey);

        printCallerMode();

        console.log("Initializer: %s", TokenPortal(l1Portal).L2_PORTAL_INITIALIZER());

        console.log("Configuring L1 Portal %s to use L2 Portal", l1Portal);
        console.logBytes32(l2Portal);
        ITokenPortal(l1Portal).setL2Portal(l2Portal);

        vm.stopBroadcast();
    }
}
