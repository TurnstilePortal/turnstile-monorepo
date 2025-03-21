import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PXE, Wallet, AztecAddress } from '@aztec/aztec.js';
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
const mockAddress = new MockAztecAddress(
  '0x1234567890123456789012345678901234567890',
);
const mockWallet = {
  getAddress: vi.fn().mockReturnValue(mockAddress),
};

// Mock the PXE
const mockPXE = {
  // Add any PXE methods that might be used
};

describe('L2Client', () => {
  let client: L2Client;

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a new client for each test
    client = new L2Client(
      mockPXE as unknown as PXE,
      mockWallet as unknown as Wallet,
    );
  });

  describe('getPXE', () => {
    it('should return the PXE client', () => {
      const pxe = client.getPXE();
      expect(pxe).toBe(mockPXE);
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
