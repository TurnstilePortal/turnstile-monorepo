import { describe, expect, it } from 'vitest';
import { l1AllowListStatusEnum, type NewToken, type Token, tokens } from '../../schema/tokens.js';

describe('tokens schema', () => {
  it('defines token table columns', () => {
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

  it('uses consistent column names', () => {
    expect(tokens.l1Address.name).toBe('l1_address');
    expect(tokens.l2Address.name).toBe('l2_address');
    expect(tokens.symbol.name).toBe('symbol');
    expect(tokens.name.name).toBe('name');
    expect(tokens.decimals.name).toBe('decimals');
  });

  it('exposes enum for allow list status', () => {
    expect(l1AllowListStatusEnum.enumName).toBe('l1_allow_list_status');
    expect(l1AllowListStatusEnum.enumValues).toEqual(['UNKNOWN', 'PROPOSED', 'ACCEPTED', 'REJECTED']);
  });

  it('provides Token types for selects', () => {
    const token: Token = {
      id: 1,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
      l1AllowListStatus: 'ACCEPTED',
      l1AllowListProposalTx: `0x${'1'.repeat(64)}`,
      l1AllowListProposer: null,
      l1AllowListApprover: null,
      l1AllowListResolutionTx: `0x${'2'.repeat(64)}`,
      l1RegistrationSubmitter: null,
      l1Address: `0x${'a'.repeat(40)}`,
      l2Address: `0x${'b'.repeat(64)}`,
      l1RegistrationBlock: 1_000_000,
      l2RegistrationAvailableBlock: null,
      l2RegistrationBlock: 500_000,
      l2RegistrationSubmitter: null,
      l2RegistrationFeePayer: null,
      l1RegistrationTx: `0x${'3'.repeat(64)}`,
      l2RegistrationTx: `0x${'4'.repeat(64)}`,
      l2RegistrationTxIndex: 0,
      l2RegistrationLogIndex: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(token.symbol).toBe('ETH');
  });

  it('provides NewToken types for inserts', () => {
    const newToken: NewToken = {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    };

    expect(newToken.symbol).toBe('USDC');
    expect(newToken.l1Address).toBeUndefined();
    expect(newToken.l2Address).toBeUndefined();
  });

  it('accepts bigint fields as numbers', () => {
    const newToken: NewToken = {
      symbol: 'TEST',
      name: 'Test Token',
      decimals: 18,
      l1RegistrationBlock: 1_000_000,
      l2RegistrationBlock: 500_000,
    };

    expect(typeof newToken.l1RegistrationBlock).toBe('number');
    expect(typeof newToken.l2RegistrationBlock).toBe('number');
  });
});
