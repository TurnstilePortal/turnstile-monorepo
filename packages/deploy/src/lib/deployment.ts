import type { Hex } from 'viem';
import type { L1Client, L2Client } from '@turnstile-portal/turnstile.js';
import { EthAddress, type AztecAddress } from '@aztec/aztec.js';
import type { DeploymentResult } from '../config/types.js';

// Import existing deployment functions
import {
  deployERC20AllowList,
  deployERC20TokenPortal,
  setL2PortalOnL1Portal,
} from './deploy/l1Portal.js';
import {
  deployBeacon,
  deployTurnstileTokenPortal,
  deployShieldGateway,
  registerTurnstileTokenContractClass,
} from './deploy/l2Portal.js';

export interface DeploymentOptions {
  allowListAdmin?: Hex;
  allowListApprover?: Hex;
  l2PortalInitializer?: Hex;
  registryAddress: Hex;
}

/**
 * Deploy Turnstile contracts to L1 (creates AllowList and TokenPortal)
 */
export async function deployL1Contracts(
  l1Client: L1Client,
  options: DeploymentOptions,
): Promise<{ allowList: Hex; tokenPortal: Hex }> {
  const allowList = await deployERC20AllowList(
    l1Client,
    options.allowListAdmin || l1Client.getAddress(),
    options.allowListApprover || l1Client.getAddress(),
  );

  const tokenPortal = await deployERC20TokenPortal(
    l1Client,
    options.registryAddress,
    allowList,
    options.l2PortalInitializer || l1Client.getAddress(),
  );

  return { allowList, tokenPortal };
}

/**
 * Deploy L2 Turnstile contracts and connect to L1
 */
export async function deployL2Contracts(
  l1Client: L1Client,
  l2Client: L2Client,
  l1Portal: Hex,
): Promise<{
  tokenContractClassID: { toString(): string };
  portal: { address: AztecAddress };
  shieldGateway: { address: AztecAddress };
}> {
  // Deploy L2 contracts
  console.log('Deploying L2 Portal...');
  const tokenContractClassID =
    await registerTurnstileTokenContractClass(l2Client);
  const shieldGateway = await deployShieldGateway(l2Client);
  const shieldGatewayBeacon = await deployBeacon(
    l2Client,
    l2Client.getAddress(),
    shieldGateway.address,
  );

  const portal = await deployTurnstileTokenPortal(
    l2Client,
    EthAddress.fromString(l1Portal),
    tokenContractClassID,
    shieldGatewayBeacon.address,
  );

  // Register L2 Portal with L1 Portal
  console.log('Registering L2 Portal with L1 Portal...');
  await setL2PortalOnL1Portal(l1Client, l1Portal, portal.address.toString());

  return { tokenContractClassID, portal, shieldGateway };
}

/**
 * Deploy complete Turnstile infrastructure (L1 and L2 contracts)
 * This function now separates L1 and L2 deployments to allow for intermediate state saving
 */
export async function deployTurnstileContracts(
  l1Client: L1Client,
  l2Client: L2Client,
  options: DeploymentOptions,
  partialDeployment?: Partial<DeploymentResult>,
): Promise<DeploymentResult> {
  let l1AllowList: Hex;
  let l1Portal: Hex;

  // Check if we already have L1 contracts deployed
  if (partialDeployment?.l1AllowList && partialDeployment?.l1Portal) {
    console.log('Using existing L1 contracts from partial deployment');
    l1AllowList = partialDeployment.l1AllowList;
    l1Portal = partialDeployment.l1Portal;
  } else {
    // Deploy L1 contracts
    console.log('Deploying L1 Portal...');
    const l1Result = await deployL1Contracts(l1Client, options);
    l1AllowList = l1Result.allowList;
    l1Portal = l1Result.tokenPortal;

    // Return partial result with just L1 contracts
    // This will be saved by the caller before proceeding with L2
    return {
      l1AllowList,
      l1Portal,
      // These will be filled in after L2 deployment
      aztecTokenContractClassID: '0x0',
      aztecPortal:
        '0x0000000000000000000000000000000000000000' as `0x${string}`,
      aztecShieldGateway:
        '0x0000000000000000000000000000000000000000' as `0x${string}`,
    };
  }

  // Deploy L2 contracts
  const { tokenContractClassID, portal, shieldGateway } =
    await deployL2Contracts(l1Client, l2Client, l1Portal);

  // Return complete deployment result
  return {
    l1AllowList,
    l1Portal,
    // We know the string is a hex string based on the framework's types
    aztecTokenContractClassID: tokenContractClassID.toString().startsWith('0x')
      ? (tokenContractClassID.toString() as `0x${string}`)
      : (`0x${tokenContractClassID.toString()}` as `0x${string}`),
    aztecPortal: portal.address.toString() as `0x${string}`,
    aztecShieldGateway: shieldGateway.address.toString() as `0x${string}`,
  };
}
