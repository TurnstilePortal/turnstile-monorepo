// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/Vm.sol";

// A base contract to use for deploying dev contracts
abstract contract DevScript is Script {
    // test salt for consistent addresses
    bytes32 public constant salt = bytes32(uint256(0x123456789abcdef));

    // addresses & private keys for dev accounts.
    // These are default anvil accounts derived from the mnemonic `test test test test test test test test test test test junk`

    // `m/44'/60'/0'/0/7`
    address public constant deployer = 0x14dC79964da2C08b23698B3D3cc7Ca32193d9955;
    uint256 public constant deployerPrivateKey = 0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356;

    // `m/44'/60'/0'/0/8`
    address public constant allowListAdmin = 0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f;
    uint256 public constant allowListAdminPrivateKey =
        0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97;

    // `m/44'/60'/0'/0/9`
    address public constant allowListApprover = 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720;
    uint256 public constant allowListApproverPrivateKey =
        0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6;

    // `m/44'/60'/0'/0/0`
    address public constant bridgeUser0 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    uint256 public constant bridgeUser0PrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    // `m/44'/60'/0'/0/1`
    address public constant bridgeUser1 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    // `m/44'/60'/0'/0/2`
    address public constant bridgeUser2 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    // `m/44'/60'/0'/0/3`
    address public constant bridgeUser3 = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;

    function printCallerMode() internal {
        VmSafe.CallerMode callerMode;
        address msgSender;
        address txOrigin;

        (callerMode, msgSender, txOrigin) = vm.readCallers();
        console.log("Caller Mode: %s", uint256(callerMode));
        console.log("Message Sender: %s", msgSender);
        console.log("Transaction Origin: %s", txOrigin);
    }
}
