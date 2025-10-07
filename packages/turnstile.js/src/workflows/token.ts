import { ERC20TokenPortalABI } from '@turnstile-portal/l1-artifacts-abi';
import {
  encodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { createError, ErrorCode } from '../errors.js';

const REGISTER_FUNCTION_ABI = [
  {
    name: 'register',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [],
  },
] as const;

const ERC20_METADATA_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string', name: '' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string', name: '' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8', name: '' }] },
] as const;

export type TokenMetadata = {
  name: string;
  symbol: string;
  decimals: number;
};

export type RegisterTokenParams = {
  l1PublicClient: PublicClient;
  portalAddress: Address;
  tokenAddress: Address;
  metadata?: Partial<TokenMetadata>;
};

export type PreparedRegistration = {
  calldata: Hex;
  request: { to: Address; data: Hex; value: bigint };
  tokenRegistered: boolean;
  metadata: TokenMetadata;
};

export async function registerToken({
  l1PublicClient,
  portalAddress,
  tokenAddress,
  metadata: providedMetadata = {},
}: RegisterTokenParams): Promise<PreparedRegistration> {
  let tokenRegistered = false;
  try {
    tokenRegistered = await l1PublicClient.readContract({
      address: portalAddress,
      abi: ERC20TokenPortalABI,
      functionName: 'registered',
      args: [tokenAddress],
    });
  } catch (error) {
    throw createError(
      ErrorCode.L1_CONTRACT_INTERACTION,
      `Failed to query registration status for token ${tokenAddress}`,
      { portalAddress, tokenAddress },
      error,
    );
  }

  const metadata = await resolveTokenMetadata(l1PublicClient, tokenAddress, providedMetadata);

  const calldata = encodeFunctionData({
    abi: REGISTER_FUNCTION_ABI,
    functionName: 'register',
    args: [tokenAddress],
  });

  return {
    calldata,
    request: { to: portalAddress, data: calldata, value: 0n },
    tokenRegistered,
    metadata,
  };
}

async function resolveTokenMetadata(
  l1PublicClient: PublicClient,
  tokenAddress: Address,
  provided: Partial<TokenMetadata>,
): Promise<TokenMetadata> {
  const metadata: Partial<TokenMetadata> = {
    name: provided.name,
    symbol: provided.symbol,
    decimals: provided.decimals,
  };

  const missingFields = (['name', 'symbol', 'decimals'] as const).filter(
    (field) => metadata[field] === undefined || metadata[field] === '',
  );

  if (!missingFields.length) {
    return metadata;
  }

  for (const field of missingFields) {
    try {
      const value = await l1PublicClient.readContract({
        address: tokenAddress,
        abi: ERC20_METADATA_ABI,
        functionName: field,
        args: [],
      });
      (metadata as Record<string, unknown>)[field] = field === 'decimals' ? Number(value) : (value as string);
    } catch (error) {
      throw createError(
        ErrorCode.L1_CONTRACT_INTERACTION,
        `Failed to read ERC20 ${field} for token ${tokenAddress}`,
        { tokenAddress },
        error,
      );
    }
  }

  return {
    name: metadata.name ?? '',
    symbol: metadata.symbol ?? '',
    decimals: metadata.decimals ?? 0,
  };
}
