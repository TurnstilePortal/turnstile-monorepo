/** biome-ignore-all lint/suspicious/noExplicitAny: tests */
import type { Contract, ContractFunctionInteraction, DeployMethod, SendMethodOptions, Wallet } from '@aztec/aztec.js';
import { AztecAddress, BatchCall } from '@aztec/aztec.js';
import type { ExecutionPayload } from '@aztec/entrypoints/payload';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractBatchBuilder } from './contract-interaction.js';

// Mock the aztec.js module
vi.mock('@aztec/aztec.js', () => ({
  BatchCall: vi.fn(),
  AztecAddress: {
    ZERO: { toString: () => '0x0000000000000000000000000000000000000000' },
  },
}));

describe('ContractBatchBuilder', () => {
  let mockWallet: Wallet;
  let builder: ContractBatchBuilder;
  let mockInteraction: ContractFunctionInteraction;
  let mockDeployMethod: DeployMethod<Contract>;
  let mockPayload: ExecutionPayload;
  let validOptions: SendMethodOptions;

  beforeEach(() => {
    mockWallet = {} as Wallet;
    builder = new ContractBatchBuilder(mockWallet);
    validOptions = { from: AztecAddress.ZERO, fee: {} } as SendMethodOptions;

    // Create mock interaction with request method
    mockInteraction = {
      request: vi.fn().mockResolvedValue({} as ExecutionPayload),
      send: vi.fn(),
      simulate: vi.fn(),
      prove: vi.fn(),
    } as unknown as ContractFunctionInteraction;

    // Create mock deploy method with request method
    mockDeployMethod = {
      request: vi.fn().mockResolvedValue({} as ExecutionPayload),
      send: vi.fn(),
      simulate: vi.fn(),
      prove: vi.fn(),
    } as unknown as DeployMethod<Contract>;

    // Create mock ExecutionPayload
    mockPayload = {} as ExecutionPayload;
  });

  describe('add', () => {
    it('should add ContractFunctionInteraction to batch', () => {
      builder.add(mockInteraction);
      expect(builder.size()).toBe(1);
    });

    it('should add DeployMethod to batch', () => {
      builder.add(mockDeployMethod);
      expect(builder.size()).toBe(1);
    });

    it('should add ExecutionPayload to batch', () => {
      builder.add(mockPayload);
      expect(builder.size()).toBe(1);
    });

    it('should support method chaining', () => {
      const result = builder.add(mockInteraction).add(mockPayload);
      expect(result).toBe(builder);
      expect(builder.size()).toBe(2);
    });
  });

  describe('addPayload', () => {
    it('should add ExecutionPayload using addPayload method', () => {
      builder.addPayload(mockPayload);
      expect(builder.size()).toBe(1);
    });

    it('should support method chaining with addPayload', () => {
      const result = builder.addPayload(mockPayload);
      expect(result).toBe(builder);
    });
  });

  describe('mixed operations', () => {
    it('should handle mix of interactions and payloads', () => {
      builder.add(mockInteraction).addPayload(mockPayload).add(mockDeployMethod);

      expect(builder.size()).toBe(3);
    });
  });

  describe('request', () => {
    it('should create payloads from interactions', async () => {
      const expectedPayload1 = { type: 'payload1' } as unknown as ExecutionPayload;
      const expectedPayload2 = { type: 'payload2' } as unknown as ExecutionPayload;

      mockInteraction.request = vi.fn().mockResolvedValue(expectedPayload1);
      mockDeployMethod.request = vi.fn().mockResolvedValue(expectedPayload2);

      builder.add(mockInteraction).add(mockDeployMethod).add(mockPayload);

      const payloads = await builder.request(validOptions);

      expect(payloads).toHaveLength(3);
      expect(payloads[0]).toBe(expectedPayload1);
      expect(payloads[1]).toBe(expectedPayload2);
      expect(payloads[2]).toBe(mockPayload);
    });
  });

  describe('size and isEmpty', () => {
    it('should return correct size', () => {
      expect(builder.size()).toBe(0);
      builder.add(mockInteraction);
      expect(builder.size()).toBe(1);
      builder.add(mockPayload);
      expect(builder.size()).toBe(2);
    });

    it('should correctly check if empty', () => {
      expect(builder.isEmpty()).toBe(true);
      builder.add(mockInteraction);
      expect(builder.isEmpty()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all interactions', () => {
      builder.add(mockInteraction).add(mockPayload);
      expect(builder.size()).toBe(2);

      builder.clear();
      expect(builder.size()).toBe(0);
      expect(builder.isEmpty()).toBe(true);
    });

    it('should support method chaining after clear', () => {
      const result = builder.add(mockInteraction).clear();
      expect(result).toBe(builder);
    });
  });

  describe('build', () => {
    it('should return array of calls', () => {
      builder.add(mockInteraction).add(mockPayload);
      const calls = builder.build();

      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe(mockInteraction);
      expect(calls[1]).toBe(mockPayload);
    });
  });

  describe('send', () => {
    it('should throw error when no interactions to send', () => {
      expect(() => builder.send(validOptions)).toThrow('No interactions to send in batch');
    });

    it('should send single interaction directly', () => {
      const mockSend = vi.fn().mockReturnValue({} as any);
      mockInteraction.send = mockSend;

      builder.add(mockInteraction);
      builder.send(validOptions);

      expect(mockSend).toHaveBeenCalledWith(validOptions);
    });

    it('should use BatchCall for ExecutionPayload', () => {
      const mockBatchSend = vi.fn().mockReturnValue({} as any);
      (BatchCall as any).mockImplementation(() => ({
        send: mockBatchSend,
      }));

      builder.add(mockPayload);
      builder.send(validOptions);

      expect(BatchCall).toHaveBeenCalledWith(mockWallet, [mockPayload]);
      expect(mockBatchSend).toHaveBeenCalledWith(validOptions);
    });

    it('should use BatchCall for multiple interactions', () => {
      const mockBatchSend = vi.fn().mockReturnValue({} as any);
      (BatchCall as any).mockImplementation(() => ({
        send: mockBatchSend,
      }));

      builder.add(mockInteraction).add(mockPayload);
      builder.send(validOptions);

      expect(BatchCall).toHaveBeenCalledWith(mockWallet, [mockInteraction, mockPayload]);
      expect(mockBatchSend).toHaveBeenCalledWith(validOptions);
    });
  });
});
