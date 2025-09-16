import { getAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import { isL1Address, isL2Address, normalizeL1Address, normalizeL2Address } from '../utils/address.js';

describe('Address Utils', () => {
  describe('normalizeL1Address', () => {
    it('should convert L1 address to lowercase', () => {
      const address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const normalized = normalizeL1Address(address);

      expect(normalized).toBe('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    });

    it('should handle already lowercase L1 addresses', () => {
      const address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
      const normalized = normalizeL1Address(address);

      expect(normalized).toBe(address);
    });

    it('should throw error for invalid L1 address', () => {
      const invalidAddress = '0xinvalid';

      expect(() => normalizeL1Address(invalidAddress)).toThrow('Invalid L1 address');
    });

    it('should throw error for L2 address', () => {
      const l2Address = `0x${'1'.repeat(64)}`;

      expect(() => normalizeL1Address(l2Address)).toThrow('Invalid L1 address');
    });
  });

  describe('normalizeL2Address', () => {
    it('should convert L2 address to lowercase', () => {
      const address = `0x${'A'.repeat(64)}`;
      const normalized = normalizeL2Address(address);

      expect(normalized).toBe(`0x${'a'.repeat(64)}`);
    });

    it('should handle mixed case L2 addresses', () => {
      const address = `0x${'AbCdEf'.repeat(10)}ABCD`;
      const normalized = normalizeL2Address(address);

      expect(normalized).toBe(address.toLowerCase());
    });

    it('should throw error for invalid L2 address length', () => {
      const shortAddress = `0x${'1'.repeat(63)}`;
      const longAddress = `0x${'1'.repeat(65)}`;

      expect(() => normalizeL2Address(shortAddress)).toThrow('Invalid L2 address');
      expect(() => normalizeL2Address(longAddress)).toThrow('Invalid L2 address');
    });

    it('should throw error for address without 0x prefix', () => {
      const address = '1'.repeat(64);

      expect(() => normalizeL2Address(address)).toThrow('Invalid L2 address');
    });

    it('should throw error for L1 address', () => {
      const l1Address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

      expect(() => normalizeL2Address(l1Address)).toThrow('Invalid L2 address');
    });
  });

  describe('isL1Address', () => {
    it('should validate correct L1 address', () => {
      const address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

      expect(isL1Address(address)).toBe(true);
    });

    it('should reject improperly checksummed L1 address', () => {
      const address = '0xA0B86991C6218B36C1D19D4A2E9EB0CE3606EB48'; // All uppercase, not proper checksum

      expect(isL1Address(address)).toBe(false);
    });

    it('should validate properly checksummed L1 address', () => {
      // Get the proper EIP-55 checksum for USDC token address
      const properChecksum = getAddress('0xa0b86991c6218a36c1d19d4a2e9eb0ce3606eb48');

      expect(isL1Address(properChecksum)).toBe(true);
    });

    it('should reject address without 0x prefix', () => {
      const address = 'a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

      expect(isL1Address(address)).toBe(false);
    });

    it('should reject address with incorrect length', () => {
      const shortAddress = '0xa0b86991c6218b36c1d19d4a';
      const longAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48ab';

      expect(isL1Address(shortAddress)).toBe(false);
      expect(isL1Address(longAddress)).toBe(false);
    });

    it('should reject address with non-hex characters', () => {
      const address = '0xg0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

      expect(isL1Address(address)).toBe(false);
    });

    it('should reject L2 address', () => {
      const address = `0x${'1'.repeat(64)}`;

      expect(isL1Address(address)).toBe(false);
    });
  });

  describe('isL2Address', () => {
    it('should validate correct L2 address', () => {
      const address = `0x${'1'.repeat(64)}`;

      expect(isL2Address(address)).toBe(true);
    });

    it('should validate uppercase L2 address', () => {
      const address = `0x${'A'.repeat(64)}`;

      expect(isL2Address(address)).toBe(true);
    });

    it('should validate mixed case L2 address', () => {
      const address = `0x${'aAbBcC'.repeat(10)}ddDD`;

      expect(isL2Address(address)).toBe(true);
    });

    it('should reject address without 0x prefix', () => {
      const address = '1'.repeat(64);

      expect(isL2Address(address)).toBe(false);
    });

    it('should reject address with incorrect length', () => {
      const shortAddress = `0x${'1'.repeat(63)}`;
      const longAddress = `0x${'1'.repeat(65)}`;

      expect(isL2Address(shortAddress)).toBe(false);
      expect(isL2Address(longAddress)).toBe(false);
    });

    it('should reject L1 address', () => {
      const address = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

      expect(isL2Address(address)).toBe(false);
    });
  });
});
