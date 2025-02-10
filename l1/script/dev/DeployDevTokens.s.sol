// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/Vm.sol";

import {DevScript} from "./DevScript.s.sol";

import {IAllowList} from "../../src/interfaces/IAllowList.sol";
import {ITokenPortal} from "../../src/interfaces/ITokenPortal.sol";
import {InsecureMintableToken} from "../../test/InsecureMintableToken.sol";

// DeployDevTokens deploys a set of test tokens for development purposes.
contract DeployDevTokens is DevScript {
    ITokenPortal public tokenPortal;
    IAllowList public allowList;

    function run(address tokenPortal_) external {
        tokenPortal = ITokenPortal(tokenPortal_);
        allowList = tokenPortal.allowList();
        deployTestTokens();
    }

    function deployTestTokens() private {
        InsecureMintableToken t;

        t = deployInsecureMintableToken("USD Coin", "USDC", 6);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Dai Stablecoin", "DAI", 18);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Tether USD", "USDT", 6);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Wrapped Ether", "WETH", 18);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Aztec Token", "AZT", 18);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Test Token 1", "TT1", 18);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Test Token 2", "TT2", 18);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Test Token 3", "TT3", 18);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Test Token 4", "TT4", 18);
        devMints(t);
        proposeAcceptRegister(address(t));

        t = deployInsecureMintableToken("Test Token 5", "TT5", 18);
        devMints(t);
        proposeAcceptRegister(address(t));
    }

    function deployInsecureMintableToken(string memory name, string memory symbol, uint8 decimals)
        internal
        returns (InsecureMintableToken token)
    {
        vm.startBroadcast(deployerPrivateKey);

        token = new InsecureMintableToken{salt: salt}(name, symbol, decimals);
        console.log("Deployed token %s at %s", symbol, address(token));

        vm.stopBroadcast();
    }

    function proposeAcceptRegister(address token) internal {
        // anyone can propose, so use bridgeUser0
        vm.startBroadcast(bridgeUser0PrivateKey);
        allowList.propose(token);
        vm.stopBroadcast();

        // only the approver can accept
        vm.startBroadcast(allowListApproverPrivateKey);
        allowList.accept(token);

        // anyone can register, so use the approver
        tokenPortal.register(address(token));
        vm.stopBroadcast();
    }

    function devMints(InsecureMintableToken token) internal {
        vm.startBroadcast(deployerPrivateKey);
        token.mint(bridgeUser0, 1000 ether);
        token.mint(bridgeUser1, 20000 ether);
        token.mint(bridgeUser2, 300000 ether);
        token.mint(bridgeUser3, 4000000 ether);

        console.log("Minted %s tokens for bridge users", token.symbol());
        vm.stopBroadcast();
    }
}
