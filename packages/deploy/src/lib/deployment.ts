import { type AztecAddress, EthAddress, type Fr } from '@aztec/aztec.js';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import type { L1Client, L2Client } from '@turnstile-portal/turnstile.js';
import { L2Portal } from '@turnstile-portal/turnstile.js';
import type { Hex } from 'viem';
import type { DeploymentResult } from '../config/types.js';

// Import existing deployment functions
import {
  deployERC20AllowList,
  deployERC20TokenPortal,
  setL2PortalOnL1Portal,
} from './deploy/l1Portal.js';
import { registerTurnstileTokenContractClass } from './deploy/l2Portal.js';

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
  tokenContractClassID: Fr;
  portal: { address: AztecAddress; instance: SerializableContractInstance };
  shieldGateway: {
    address: AztecAddress;
    instance: SerializableContractInstance;
  };
}> {
  // Deploy L2 contracts
  console.log('Deploying L2 Portal...');
  const tokenContractClassID =
    await registerTurnstileTokenContractClass(l2Client);

  const { shieldGateway, portal } = await L2Portal.deploy(
    l2Client,
    EthAddress.fromString(l1Portal),
    tokenContractClassID,
  );

  // Register L2 Portal with L1 Portal
  console.log('Registering L2 Portal with L1 Portal...');
  await setL2PortalOnL1Portal(l1Client, l1Portal, portal.address.toString());

  return {
    tokenContractClassID,
    portal: {
      address: portal.address,
      instance: new SerializableContractInstance(portal.instance),
    },
    shieldGateway: {
      address: shieldGateway.address,
      instance: new SerializableContractInstance(shieldGateway.instance),
    },
  };
}

/**
 * Deploy complete Turnstile infrastructure (L1 and L2 contracts)
 * Always deploys both L1 and L2 contracts in a single operation
 */
export async function deployTurnstileContracts(
  l1Client: L1Client,
  l2Client: L2Client,
  options: DeploymentOptions,
): Promise<DeploymentResult> {
  // Deploy L1 contracts
  console.log('Deploying L1 contracts...');
  const l1Result = await deployL1Contracts(l1Client, options);
  const l1AllowList = l1Result.allowList;
  const l1Portal = l1Result.tokenPortal;

  // Deploy L2 contracts
  console.log('Deploying L2 contracts...');
  const { tokenContractClassID, portal, shieldGateway } =
    await deployL2Contracts(l1Client, l2Client, l1Portal);

  // Return complete deployment result
  return {
    l1AllowList,
    l1Portal,
    aztecTokenContractClassID: tokenContractClassID.toString(),
    aztecPortal: portal.address.toString() as `0x${string}`,
    serializedAztecPortalInstance: `0x${portal.instance.toBuffer().toString('hex')}`,
    aztecShieldGateway: shieldGateway.address.toString() as `0x${string}`,
    serializedShieldGatewayInstance: `0x${shieldGateway.instance.toBuffer().toString('hex')}`,
  };
}
