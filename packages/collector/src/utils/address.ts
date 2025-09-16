import { getAddress, isAddress } from 'viem';

export function normalizeL1Address(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new Error(`Invalid L1 address: ${address}`);
  }
  return getAddress(address).toLowerCase() as `0x${string}`;
}

export function normalizeL2Address(address: string): `0x${string}` {
  if (!address.startsWith('0x') || address.length !== 66) {
    throw new Error(`Invalid L2 address: ${address}`);
  }
  return address.toLowerCase() as `0x${string}`;
}

export function isL2Address(address: string): address is `0x${string}` {
  return address.startsWith('0x') && address.length === 66;
}

// Re-export viem's isAddress as isL1Address for semantic clarity
export { isAddress as isL1Address } from 'viem';
