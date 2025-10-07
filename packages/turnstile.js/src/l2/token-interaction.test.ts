// @ts-nocheck
import type { ContractFunctionInteraction, SendMethodOptions, SimulateMethodOptions, Wallet } from '@aztec/aztec.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtendedBatchCall } from '../utils/extended-batch-call.js';
import { L2TokenBatchBuilder, L2TokenInteraction } from './token-interaction.js';

// Mock the imports
vi.mock('@aztec/aztec.js');
vi.mock('../utils/extended-batch-call.js');

describe('L2TokenInteraction', () => {
  let mockInteraction: ContractFunctionInteraction;
  let tokenInteraction: L2TokenInteraction;

  beforeEach(() => {
    vi.resetAllMocks();

    mockInteraction = {
      send: vi.fn().mockReturnValue({ txHash: '0x123' }),
      simulate: vi.fn().mockResolvedValue({ result: 'simulated' }),
      request: vi.fn().mockResolvedValue({ payload: 'request' }),
      prove: vi.fn().mockResolvedValue({ proof: 'proved' }),
    } as unknown as ContractFunctionInteraction;

    tokenInteraction = new L2TokenInteraction(mockInteraction);
  });

  describe('constructor', () => {
    it('should wrap a ContractFunctionInteraction', () => {
      expect(tokenInteraction).toBeInstanceOf(L2TokenInteraction);
      expect(tokenInteraction.getInteraction()).toBe(mockInteraction);
    });
  });

  describe('send', () => {
    it('should delegate to underlying interaction', () => {
      const options = { from: '0xabc' } as unknown as SendMethodOptions;
      const result = tokenInteraction.send(options);

      expect(mockInteraction.send).toHaveBeenCalledWith(options);
      expect(result).toEqual({ txHash: '0x123' });
    });
  });

  describe('simulate', () => {
    it('should delegate to underlying interaction', async () => {
      const options = { includeMetadata: true } as SimulateMethodOptions;
      const result = await tokenInteraction.simulate(options);

      expect(mockInteraction.simulate).toHaveBeenCalledWith(options);
      expect(result).toEqual({ result: 'simulated' });
    });

    it('should use empty options if none provided', async () => {
      await tokenInteraction.simulate();
      expect(mockInteraction.simulate).toHaveBeenCalledWith({});
    });
  });

  describe('request', () => {
    it('should delegate to underlying interaction', async () => {
      const options = { from: '0xabc' } as unknown as SendMethodOptions;
      const result = await tokenInteraction.request(options);

      expect(mockInteraction.request).toHaveBeenCalledWith(options);
      expect(result).toEqual({ payload: 'request' });
    });
  });

  describe('prove', () => {
    it('should delegate to underlying interaction', async () => {
      const options = { from: '0xabc' } as unknown as SendMethodOptions;
      const result = await tokenInteraction.prove(options);

      expect(mockInteraction.prove).toHaveBeenCalledWith(options);
      expect(result).toEqual({ proof: 'proved' });
    });
  });
});

describe('L2TokenBatchBuilder', () => {
  let mockWallet: Wallet;
  let batchBuilder: L2TokenBatchBuilder;
  let mockInteraction1: ContractFunctionInteraction;
  let mockInteraction2: ContractFunctionInteraction;

  beforeEach(() => {
    vi.resetAllMocks();

    mockWallet = {
      getAddress: vi.fn().mockReturnValue('0xwallet'),
    } as unknown as Wallet;

    mockInteraction1 = {
      send: vi.fn().mockReturnValue({ txHash: '0x111' }),
      simulate: vi.fn().mockResolvedValue({ result: 'sim1' }),
      request: vi.fn().mockResolvedValue({ payload: 'req1' }),
      prove: vi.fn().mockResolvedValue({ proof: 'proof1' }),
    } as unknown as ContractFunctionInteraction;

    mockInteraction2 = {
      send: vi.fn().mockReturnValue({ txHash: '0x222' }),
      simulate: vi.fn().mockResolvedValue({ result: 'sim2' }),
      request: vi.fn().mockResolvedValue({ payload: 'req2' }),
      prove: vi.fn().mockResolvedValue({ proof: 'proof2' }),
    } as unknown as ContractFunctionInteraction;

    // Mock ExtendedBatchCall
    ExtendedBatchCall.mockImplementation((_wallet, _interactions) => ({
      send: vi.fn().mockReturnValue({ txHash: '0xbatch' }),
      simulate: vi.fn().mockResolvedValue({ result: 'batch-sim' }),
      prove: vi.fn().mockResolvedValue({ proof: 'batch-proof' }),
    }));

    batchBuilder = new L2TokenBatchBuilder(mockWallet);
  });

  describe('constructor', () => {
    it('should initialize with wallet', () => {
      expect(batchBuilder).toBeInstanceOf(L2TokenBatchBuilder);
      expect(batchBuilder.size()).toBe(0);
    });
  });

  describe('add', () => {
    it('should add ContractFunctionInteraction to batch', () => {
      const result = batchBuilder.add(mockInteraction1);

      expect(result).toBe(batchBuilder); // Check chaining
      expect(batchBuilder.size()).toBe(1);
    });

    it('should add L2TokenInteraction to batch', () => {
      const tokenInteraction = new L2TokenInteraction(mockInteraction1);
      const result = batchBuilder.add(tokenInteraction);

      expect(result).toBe(batchBuilder); // Check chaining
      expect(batchBuilder.size()).toBe(1);
    });
  });

  describe('named add methods', () => {
    it('should add operations using named methods', () => {
      const tokenInteraction1 = new L2TokenInteraction(mockInteraction1);
      const tokenInteraction2 = new L2TokenInteraction(mockInteraction2);

      batchBuilder
        .addTransferPublic(tokenInteraction1)
        .addTransferPrivate(tokenInteraction2)
        .addShield(tokenInteraction1)
        .addUnshield(tokenInteraction2);

      expect(batchBuilder.size()).toBe(4);
    });
  });

  describe('send', () => {
    it('should throw error when no interactions', () => {
      const options = { from: '0xabc' } as unknown as SendMethodOptions;
      expect(() => batchBuilder.send(options)).toThrow('No interactions to send in batch');
    });

    it('should send single interaction directly', () => {
      const options = { from: '0xabc' } as unknown as SendMethodOptions;
      batchBuilder.add(mockInteraction1);
      const result = batchBuilder.send(options);

      expect(mockInteraction1.send).toHaveBeenCalledWith(options);
      expect(result).toEqual({ txHash: '0x111' });
    });

    it('should use ExtendedBatchCall for multiple interactions', () => {
      const options = { from: '0xabc' } as unknown as SendMethodOptions;
      batchBuilder.add(mockInteraction1).add(mockInteraction2);
      const result = batchBuilder.send(options);

      expect(ExtendedBatchCall).toHaveBeenCalledWith(mockWallet, [mockInteraction1, mockInteraction2]);
      expect(result).toEqual({ txHash: '0xbatch' });
    });
  });

  describe('simulate', () => {
    it('should throw error when no interactions', async () => {
      await expect(batchBuilder.simulate()).rejects.toThrow('No interactions to simulate in batch');
    });

    it('should simulate single interaction directly', async () => {
      const options = { includeMetadata: true } as SimulateMethodOptions;
      batchBuilder.add(mockInteraction1);
      const result = await batchBuilder.simulate(options);

      expect(mockInteraction1.simulate).toHaveBeenCalledWith(options);
      expect(result).toEqual({ result: 'sim1' });
    });

    it('should use ExtendedBatchCall for multiple interactions', async () => {
      batchBuilder.add(mockInteraction1).add(mockInteraction2);
      const result = await batchBuilder.simulate();

      expect(ExtendedBatchCall).toHaveBeenCalledWith(mockWallet, [mockInteraction1, mockInteraction2]);
      expect(result).toEqual({ result: 'batch-sim' });
    });
  });

  describe('request', () => {
    it('should return execution payloads for all interactions', async () => {
      const options = { from: '0xabc' } as unknown as SendMethodOptions;
      batchBuilder.add(mockInteraction1).add(mockInteraction2);
      const result = await batchBuilder.request(options);

      expect(mockInteraction1.request).toHaveBeenCalledWith(options);
      expect(mockInteraction2.request).toHaveBeenCalledWith(options);
      expect(result).toEqual([{ payload: 'req1' }, { payload: 'req2' }]);
    });
  });

  describe('build', () => {
    it('should return raw interactions array', () => {
      batchBuilder.add(mockInteraction1).add(mockInteraction2);
      const result = batchBuilder.build();

      expect(result).toEqual([mockInteraction1, mockInteraction2]);
    });
  });

  describe('clear', () => {
    it('should clear all interactions', () => {
      batchBuilder.add(mockInteraction1).add(mockInteraction2);
      expect(batchBuilder.size()).toBe(2);

      const result = batchBuilder.clear();
      expect(result).toBe(batchBuilder); // Check chaining
      expect(batchBuilder.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('should return the number of interactions', () => {
      expect(batchBuilder.size()).toBe(0);
      batchBuilder.add(mockInteraction1);
      expect(batchBuilder.size()).toBe(1);
      batchBuilder.add(mockInteraction2);
      expect(batchBuilder.size()).toBe(2);
    });
  });
});
