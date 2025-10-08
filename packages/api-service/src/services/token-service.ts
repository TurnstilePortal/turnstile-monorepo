import { type DbClient, tokens } from '@turnstile-portal/api-common';
import { and, asc, eq, gt, isNotNull, isNull, or, type SQL } from 'drizzle-orm';

type TokenRow = typeof tokens.$inferSelect;

export interface Token {
  id?: number;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  l1_address?: string;
  l2_address?: string;
  l1_allow_list_status?: string | null;
  l1_allow_list_proposal_tx?: string | null;
  l1_allow_list_proposer?: string | null;
  l1_allow_list_approver?: string | null;
  l1_allow_list_resolution_tx?: string | null;
  l1_registration_submitter?: string | null;
  l1_registration_block?: number | null;
  l2_registration_available_block?: number | null;
  l2_registration_block?: number | null;
  l2_registration_submitter?: string | null;
  l2_registration_fee_payer?: string | null;
  l1_registration_tx?: string | null;
  l2_registration_tx?: string | null;
  l2_registration_tx_index?: number | null;
  l2_registration_log_index?: number | null;
  l1_to_l2_message_hash?: string | null;
  l1_to_l2_message_index?: number | null;
}

export function convertDbTokenToApi(dbToken: typeof tokens.$inferSelect, includeId = false): Token {
  const token: Token = {
    symbol: dbToken.symbol,
    name: dbToken.name,
    decimals: dbToken.decimals,
  };

  if (includeId) {
    token.id = dbToken.id;
  }

  if (dbToken.l1Address) {
    token.l1_address = dbToken.l1Address;
  }

  if (dbToken.l2Address) {
    token.l2_address = dbToken.l2Address;
  }

  if (dbToken.l1AllowListStatus) {
    token.l1_allow_list_status = dbToken.l1AllowListStatus;
  }

  if (dbToken.l1AllowListProposalTx) {
    token.l1_allow_list_proposal_tx = dbToken.l1AllowListProposalTx;
  }

  if (dbToken.l1AllowListProposer) {
    token.l1_allow_list_proposer = dbToken.l1AllowListProposer;
  }

  if (dbToken.l1AllowListApprover) {
    token.l1_allow_list_approver = dbToken.l1AllowListApprover;
  }

  if (dbToken.l1AllowListResolutionTx) {
    token.l1_allow_list_resolution_tx = dbToken.l1AllowListResolutionTx;
  }

  if (dbToken.l1RegistrationSubmitter) {
    token.l1_registration_submitter = dbToken.l1RegistrationSubmitter;
  }

  if (dbToken.l1RegistrationBlock) {
    token.l1_registration_block = dbToken.l1RegistrationBlock;
  }

  if (dbToken.l2RegistrationAvailableBlock) {
    token.l2_registration_available_block = dbToken.l2RegistrationAvailableBlock;
  }

  if (dbToken.l2RegistrationBlock) {
    token.l2_registration_block = dbToken.l2RegistrationBlock;
  }

  if (dbToken.l2RegistrationSubmitter) {
    token.l2_registration_submitter = dbToken.l2RegistrationSubmitter;
  }

  if (dbToken.l2RegistrationFeePayer) {
    token.l2_registration_fee_payer = dbToken.l2RegistrationFeePayer;
  }

  if (dbToken.l1RegistrationTx) {
    token.l1_registration_tx = dbToken.l1RegistrationTx;
  }

  if (dbToken.l2RegistrationTx) {
    token.l2_registration_tx = dbToken.l2RegistrationTx;
  }

  if (dbToken.l2RegistrationTxIndex) {
    token.l2_registration_tx_index = dbToken.l2RegistrationTxIndex;
  }

  if (dbToken.l2RegistrationLogIndex) {
    token.l2_registration_log_index = dbToken.l2RegistrationLogIndex;
  }

  if (dbToken.l1ToL2MessageHash) {
    token.l1_to_l2_message_hash = dbToken.l1ToL2MessageHash;
  }

  if (dbToken.l1ToL2MessageIndex) {
    token.l1_to_l2_message_index = dbToken.l1ToL2MessageIndex;
  }

  return token;
}

export function isTokenComplete(token: Token): boolean {
  return token.l1_address !== undefined && token.l2_address !== undefined;
}

export class TokenService {
  constructor(private db: DbClient) {}

  async getTokens(cursor: number, limit: number): Promise<TokenRow[]> {
    const conditions = cursor > 0 ? [gt(tokens.id, cursor)] : [];

    return this.db
      .select()
      .from(tokens)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(tokens.id))
      .limit(limit + 1);
  }

  async getTokenByAddress(normalizedAddress: string): Promise<TokenRow[]> {
    return this.db
      .select()
      .from(tokens)
      .where(or(eq(tokens.l1Address, normalizedAddress), eq(tokens.l2Address, normalizedAddress)));
  }

  async getProposedTokens(cursor: number, limit: number): Promise<TokenRow[]> {
    const conditions: SQL[] = [eq(tokens.l1AllowListStatus, 'PROPOSED')];
    if (cursor > 0) {
      conditions.push(gt(tokens.id, cursor));
    }

    return this.db
      .select()
      .from(tokens)
      .where(and(...conditions))
      .orderBy(asc(tokens.id))
      .limit(limit + 1);
  }

  async getRejectedTokens(cursor: number, limit: number): Promise<TokenRow[]> {
    const conditions: SQL[] = [eq(tokens.l1AllowListStatus, 'REJECTED')];
    if (cursor > 0) {
      conditions.push(gt(tokens.id, cursor));
    }

    return this.db
      .select()
      .from(tokens)
      .where(and(...conditions))
      .orderBy(asc(tokens.id))
      .limit(limit + 1);
  }

  async getAcceptedTokens(cursor: number, limit: number): Promise<TokenRow[]> {
    const conditions: SQL[] = [eq(tokens.l1AllowListStatus, 'ACCEPTED')];

    const l2Condition = or(isNull(tokens.l2Address), isNull(tokens.l2RegistrationBlock));
    if (l2Condition) {
      conditions.push(l2Condition);
    }

    if (cursor > 0) {
      conditions.push(gt(tokens.id, cursor));
    }

    return this.db
      .select()
      .from(tokens)
      .where(and(...conditions))
      .orderBy(asc(tokens.id))
      .limit(limit + 1);
  }

  async getBridgedTokens(cursor: number, limit: number): Promise<TokenRow[]> {
    const conditions: SQL[] = [
      isNotNull(tokens.l1Address),
      isNotNull(tokens.l2Address),
      isNotNull(tokens.symbol),
      isNotNull(tokens.name),
      isNotNull(tokens.decimals),
    ];

    if (cursor > 0) {
      conditions.push(gt(tokens.id, cursor));
    }

    return this.db
      .select()
      .from(tokens)
      .where(and(...conditions))
      .orderBy(asc(tokens.id))
      .limit(limit + 1);
  }

  async testConnection(): Promise<TokenRow[]> {
    return this.db.select().from(tokens).limit(1);
  }
}
