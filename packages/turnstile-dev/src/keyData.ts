import type { Hex } from 'viem';

export interface KeyData {
  l1Address: Hex;
  l1PrivateKey: Hex;
  l2Address: Hex;
  l2EncKey: Hex;
  l2SecretKey: Hex;
  l2SigningKey: Hex;
  l2Salt: Hex;
}

export async function readKeyData(filePath: string): Promise<KeyData> {
  if (typeof window === 'undefined') {
    // Node.js environment
    const { readFileSync } = await import('node:fs');
    const data = readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as KeyData;
  }
  const response = await fetch(filePath);
  const data = await response.json();
  return data as KeyData;
}
