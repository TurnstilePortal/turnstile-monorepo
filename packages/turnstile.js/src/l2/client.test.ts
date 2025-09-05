import type { AztecNode, Wallet } from '@aztec/aztec.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { L2Client } from './client.js';

// Mock AztecAddress type
class MockAztecAddress {
  value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString() {
    return this.value;
  }
}

// Mock the wallet
const mockAddress = new MockAztecAddress('0x1234567890123456789012345678901234567890');
const mockWallet = {
  getAddress: vi.fn().mockReturnValue(mockAddress),
};

// Mock the AztecNode
const mockAztecNode = {};

describe('L2Client', () => {
  let client: L2Client;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a new client for each test
    client = new L2Client(mockAztecNode as unknown as AztecNode, mockWallet as unknown as Wallet);
  });

  describe('getNode', () => {
    it('should return the AztecNode client', () => {
      const node = client.getNode();
      expect(node).toBe(mockAztecNode);
    });
  });

  describe('getWallet', () => {
    it('should return the wallet', () => {
      const wallet = client.getWallet();
      expect(wallet).toBe(mockWallet);
    });
  });

  describe('getAddress', () => {
    it('should return the account address', () => {
      // Ensure the mock is set up correctly
      mockWallet.getAddress.mockReturnValue(mockAddress);

      // Call the method
      const address = client.getAddress();

      // Verify the result
      expect(address).toBe(mockAddress);
      expect(mockWallet.getAddress).toHaveBeenCalledTimes(1);
    });
  });
});
