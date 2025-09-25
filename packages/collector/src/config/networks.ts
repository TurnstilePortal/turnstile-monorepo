import { createAztecNodeClient } from '@aztec/aztec.js';
import { TurnstileFactory } from '@turnstile-portal/turnstile.js';
import { isL1Address, isL2Address } from '../utils/address.js';
import { getL1AllowListFromL1Portal } from '../utils/l1.js';

export interface NetworkConfig {
  name: string;
  l1: {
    rpcUrl: string;
    portalAddress: `0x${string}`;
    allowListAddress: `0x${string}`;
    inboxAddress: `0x${string}`;
    startBlock: number;
    chunkSize: number;
    network: string;
  };
  l2: {
    nodeUrl: string;
    portalAddress: `0x${string}`;
    startBlock: number;
    chunkSize: number;
    artifactsApiUrl?: string;
  };
}
export async function getNetworkConfig(): Promise<NetworkConfig> {
  const network = process.env.NETWORK;
  if (!network) {
    throw new Error('NETWORK environment variable is required');
  }

  const l1RpcUrl = process.env.L1_RPC_URL;
  const l1StartBlock = process.env.L1_START_BLOCK;
  const l1ChunkSize = process.env.L1_CHUNK_SIZE;
  const l2NodeUrl = process.env.L2_NODE_URL;
  const l2StartBlock = process.env.L2_START_BLOCK;
  const l2ChunkSize = process.env.L2_CHUNK_SIZE;
  const artifactsApiUrl = process.env.ARTIFACTS_API_URL;

  if (!l1RpcUrl) throw new Error('L1_RPC_URL environment variable is required');
  if (!l1StartBlock) throw new Error('L1_START_BLOCK environment variable is required');
  if (!l1ChunkSize) throw new Error('L1_CHUNK_SIZE environment variable is required');
  if (!l2NodeUrl) throw new Error('L2_NODE_URL environment variable is required');
  if (!l2StartBlock) throw new Error('L2_START_BLOCK environment variable is required');
  if (!l2ChunkSize) throw new Error('L2_CHUNK_SIZE environment variable is required');

  // Get portal addresses dynamically from TurnstileFactory
  let l1PortalAddress: string;
  let l2PortalAddress: string;
  let l1AllowListAddress: string;

  if (['sandbox', 'testnet', 'mainnet'].includes(network)) {
    const factory = await TurnstileFactory.fromConfig('sandbox');
    const deploymentData = factory.getDeploymentData();
    l1PortalAddress = deploymentData.l1Portal;
    l1AllowListAddress = deploymentData.l1AllowList;
    l2PortalAddress = deploymentData.aztecPortal;
  } else {
    // For other environments, fall back to environment variables
    const envL1Portal = process.env.L1_PORTAL_ADDRESS;
    const envL2Portal = process.env.L2_PORTAL_ADDRESS;

    if (!envL1Portal) throw new Error('L1_PORTAL_ADDRESS environment variable is required for non-sandbox networks');
    if (!envL2Portal) throw new Error('L2_PORTAL_ADDRESS environment variable is required for non-sandbox networks');

    l1PortalAddress = envL1Portal;
    l2PortalAddress = envL2Portal;

    l1AllowListAddress = await getL1AllowListFromL1Portal({
      rpcUrl: l1RpcUrl,
      portalAddress: l1PortalAddress,
      network: network,
    });
  }

  // Get L1 inbox address dynamically from Aztec node
  const aztecNode = createAztecNodeClient(l2NodeUrl);
  const l1ContractAddresses = await aztecNode.getL1ContractAddresses();
  const l1InboxAddress = l1ContractAddresses.inboxAddress.toString();

  if (!isL1Address(l1PortalAddress)) {
    throw new Error(`Invalid L1 portal address: ${l1PortalAddress}`);
  }
  if (!isL1Address(l1AllowListAddress)) {
    throw new Error(`Invalid L1 allow list address: ${l1AllowListAddress}`);
  }
  if (!isL2Address(l2PortalAddress)) {
    throw new Error(`Invalid L2 portal address: ${l2PortalAddress}`);
  }

  return {
    name: network,
    l1: {
      rpcUrl: l1RpcUrl,
      portalAddress: l1PortalAddress,
      allowListAddress: l1AllowListAddress,
      inboxAddress: l1InboxAddress,
      startBlock: Number(l1StartBlock),
      chunkSize: Number(l1ChunkSize),
      network,
    },
    l2: {
      nodeUrl: l2NodeUrl,
      portalAddress: l2PortalAddress,
      startBlock: Number(l2StartBlock),
      chunkSize: Number(l2ChunkSize),
      artifactsApiUrl,
    },
  };
}
