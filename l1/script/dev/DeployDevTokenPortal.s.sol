// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/Vm.sol";

import {DevScript} from "./DevScript.s.sol";

import {IMinimalAztecRegistry} from "../../src/interfaces/IMinimalAztecRegistry.sol";
import {InsecureMintableToken} from "../../test/InsecureMintableToken.sol";
import {ERC20TokenPortal} from "../../src/ERC20TokenPortal.sol";
import {ERC20AllowList} from "../../src/ERC20AllowList.sol";

import {IMinimalAztecInbox} from "../../src/interfaces/IMinimalAztecInbox.sol";
import {IMinimalAztecOutbox} from "../../src/interfaces/IMinimalAztecOutbox.sol";
import {IMinimalAztecRollup} from "../../src/interfaces/IMinimalAztecRollup.sol";
import {IMinimalAztecRegistry} from "../../src/interfaces/IMinimalAztecRegistry.sol";
import {FakeAztecRollup} from "../../test/fakeAztec/FakeAztecRollup.sol";
import {FakeAztecRegistry} from "../../test/fakeAztec/FakeAztecRegistry.sol";
import {FakeAztecInbox} from "../../test/fakeAztec/FakeAztecInbox.sol";
import {FakeAztecOutbox} from "../../test/fakeAztec/FakeAztecOutbox.sol";

// Usage: forge script script/dev/DeployDevTokenPortal.s.sol --sig "run(address)" 0xAztecRegistryAddress
contract DeployDevTokenPortal is DevScript {
    ERC20AllowList allowList;
    ERC20TokenPortal tokenPortal;

    // If called without arguments, deploy a fake Aztec Rollup setup
    function run() external {
        vm.startBroadcast(deployerPrivateKey);
        IMinimalAztecInbox inbox = new FakeAztecInbox{salt: salt}();
        IMinimalAztecOutbox outbox = new FakeAztecOutbox{salt: salt}();
        IMinimalAztecRollup rollup = new FakeAztecRollup{salt: salt}(inbox, outbox);
        IMinimalAztecRegistry registry = new FakeAztecRegistry{salt: salt}(rollup);
        vm.stopBroadcast();

        // Deploy with our fake AztecRegistry
        run(address(registry));
    }

    function run(address aztecRegistry) public {
        deployTokenPortal(aztecRegistry);
    }

    function deployTokenPortal(address aztecRegistry) private {
        vm.startBroadcast(deployerPrivateKey);

        printCallerMode();

        // Deploy the ERC20 AllowList and TokenPortal contracts
        allowList = new ERC20AllowList{salt: salt}(allowListAdmin, allowListApprover);

        tokenPortal = new ERC20TokenPortal{salt: salt}(IMinimalAztecRegistry(aztecRegistry), allowList, deployer);

        console.log("AztecRegistry: %s", aztecRegistry);
        console.log("Deployed ERC20 AllowList at %s", address(allowList));
        console.log("Deployed TokenPortal at %s", address(tokenPortal));

        vm.stopBroadcast();
    }
}
