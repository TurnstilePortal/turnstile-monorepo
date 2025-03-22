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
 * Deploy complete Turnstile infrastructure (L1 and L2 contracts)
 */
export async function deployTurnstileContracts(
  l1Client: L1Client,
  l2Client: L2Client,
  options: DeploymentOptions,
): Promise<DeploymentResult> {
  // Deploy L1 contracts
  console.log('Deploying L1 Portal...');
  const { allowList, tokenPortal: l1Portal } = await deployL1Contracts(
    l1Client,
    options,
  );

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

  // Return deployment result
  return {
    l1AllowList: allowList,
    l1Portal: l1Portal,
    aztecTokenContractClassID: tokenContractClassID.toString(),
    aztecPortal: portal.address.toString(),
    aztecShieldGateway: shieldGateway.address.toString(),
  };
}
