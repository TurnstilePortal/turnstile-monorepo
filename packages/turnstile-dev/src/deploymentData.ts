import type { Hex } from 'viem';

export interface DeploymentDataToken {
  name: string;
  symbol: string;
  decimals: number;
  l2Address: Hex;
  l1Address: Hex;
}

export interface DeploymentData {
  // These are the contracts pre-deployed on the network.
  rollupAddress: Hex;
  registryAddress: Hex;
  inboxAddress: Hex;
  outboxAddress: Hex;
  feeJuiceAddress: Hex;
  stakingAssetAddress: Hex;
  feeJuicePortalAddress: Hex;
  coinIssuerAddress: Hex;
  rewardDistributorAddress: Hex;
  governanceProposerAddress: Hex;
  governanceAddress: Hex;

  // These are the addresses of the contracts we deploy.
  l1Portal: Hex;
  l1AllowList: Hex;
  aztecTokenContractClassID: Hex;
  aztecPortal: Hex;
  aztecShieldGateway: Hex;
  aztecShieldGatewayStorage: Hex;
  devAdvanceBlock: Hex;

  // This is intended for use with dev deployments where we're deploying
  // the tokens ourselves.
  tokens: Record<string, DeploymentDataToken>;
}

export async function readDeploymentData(
  filePath: string,
): Promise<DeploymentData> {
  if (typeof window === 'undefined') {
    // Node.js environment
    const { readFileSync } = await import('node:fs');
    const data = readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as DeploymentData;
  }
  const response = await fetch(filePath);
  const data = await response.json();
  return data as DeploymentData;
}

export async function writeDeploymentData(
  filePath: string,
  data: DeploymentData,
) {
  if (typeof window === 'undefined') {
    // Node.js environment
    const { writeFileSync } = await import('node:fs');
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  } else {
    throw new Error('writeDeploymentData is not supported in the browser');
  }
}
