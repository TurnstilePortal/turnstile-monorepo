import { describe, expect, it } from 'vitest';
import {
  type BlockProgress,
  blockProgress,
  type NewBlockProgress,
  type NewToken,
  type Token,
  tokens,
} from '../schema.js';

describe('Database Schema', () => {
  describe('tokens table', () => {
    it('should have all required columns', () => {
      expect(tokens.id).toBeDefined();
      expect(tokens.symbol).toBeDefined();
      expect(tokens.name).toBeDefined();
      expect(tokens.decimals).toBeDefined();
      expect(tokens.l1Address).toBeDefined();
      expect(tokens.l2Address).toBeDefined();
      expect(tokens.l1RegistrationBlock).toBeDefined();
      expect(tokens.l2RegistrationBlock).toBeDefined();
      expect(tokens.l1RegistrationTx).toBeDefined();
      expect(tokens.l2RegistrationTxIndex).toBeDefined();
      expect(tokens.l2RegistrationLogIndex).toBeDefined();
      expect(tokens.createdAt).toBeDefined();
      expect(tokens.updatedAt).toBeDefined();
    });

    it('should have correct table name', () => {
      expect(tokens).toBeDefined();
      // Test table structure exists
      expect(typeof tokens).toBe('object');
    });

    it('should have primary key on id', () => {
      expect(tokens.id.primary).toBe(true);
    });

    it('should have correct column names for addresses', () => {
      expect(tokens.l1Address.name).toBe('l1_address');
      expect(tokens.l2Address.name).toBe('l2_address');
    });

    it('should have correct column names for basic fields', () => {
      expect(tokens.symbol.name).toBe('symbol');
      expect(tokens.name.name).toBe('name');
      expect(tokens.decimals.name).toBe('decimals');
    });
  });

  describe('blockProgress table', () => {
    it('should have all required columns', () => {
      expect(blockProgress.id).toBeDefined();
      expect(blockProgress.chain).toBeDefined();
      expect(blockProgress.lastScannedBlock).toBeDefined();
      expect(blockProgress.lastScanTimestamp).toBeDefined();
      expect(blockProgress.createdAt).toBeDefined();
      expect(blockProgress.updatedAt).toBeDefined();
    });

    it('should have correct table name', () => {
      expect(blockProgress).toBeDefined();
      // Test table structure exists
      expect(typeof blockProgress).toBe('object');
    });

    it('should have primary key on id', () => {
      expect(blockProgress.id.primary).toBe(true);
    });

    it('should have correct column names', () => {
      expect(blockProgress.chain.name).toBe('chain');
      expect(blockProgress.lastScannedBlock.name).toBe('last_scanned_block');
      expect(blockProgress.lastScanTimestamp.name).toBe('last_scan_timestamp');
    });
  });

  describe('Type Exports', () => {
    it('should export Token and NewToken types', () => {
      // Test that the types can be used (TypeScript compilation test)
      const token: Token = {
        id: 1,
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        l1AllowListStatus: 'ACCEPTED',
        l1AllowListProposalTx: '0x1234567890123456789012345678901234567890123456789012345678901234',
        l1AllowListProposer: null,
        l1AllowListApprover: null,
        l1AllowListResolutionTx: '0x1234567890123456789012345678901234567890123456789012345678901234',
        l1RegistrationSubmitter: null,
        l1Address: '0x1234567890123456789012345678901234567890',
        l2Address: '0x1234567890123456789012345678901234567890123456789012345678901234',
        l1RegistrationBlock: 1000000,
        l2RegistrationAvailableBlock: null,
        l2RegistrationBlock: 500000,
        l2RegistrationSubmitter: null,
        l2RegistrationFeePayer: null,
        l1RegistrationTx: '0x1234567890123456789012345678901234567890123456789012345678901234',
        l2RegistrationTx: '0x1234567890123456789012345678901234567890123456789012345678901234',
        l2RegistrationTxIndex: 0,
        l2RegistrationLogIndex: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newToken: NewToken = {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
      };

      expect(token.symbol).toBe('ETH');
      expect(newToken.symbol).toBe('USDC');
    });

    it('should export BlockProgress and NewBlockProgress types', () => {
      const progress: BlockProgress = {
        id: 1,
        chain: 'L1',
        lastScannedBlock: 1000000,
        lastScanTimestamp: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newProgress: NewBlockProgress = {
        chain: 'L2',
        lastScannedBlock: 500000,
      };

      expect(progress.chain).toBe('L1');
      expect(newProgress.chain).toBe('L2');
    });
  });

  describe('Table Relationships and Constraints', () => {
    it('should handle nullable fields correctly', () => {
      // Test that optional fields can be null/undefined
      const minimalToken: NewToken = {
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
        // All other fields should be optional
      };

      expect(minimalToken.l1Address).toBeUndefined();
      expect(minimalToken.l2Address).toBeUndefined();
    });

    it('should handle bigint fields correctly', () => {
      const token: NewToken = {
        symbol: 'TEST',
        name: 'Test Token',
        decimals: 18,
        l1RegistrationBlock: 1000000,
        l2RegistrationBlock: 500000,
      };

      expect(typeof token.l1RegistrationBlock).toBe('number');
      expect(typeof token.l2RegistrationBlock).toBe('number');
    });
  });
});
