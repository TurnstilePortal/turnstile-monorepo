import type { Address } from 'viem';
import type { AztecAddress, Fr } from '@aztec/aztec.js';

/**
 * Generate an error message for token operations
 * @param operation The operation that failed (e.g., 'get symbol', 'transfer')
 * @param tokenAddress The token address
 * @param details Optional additional details about the operation
 * @returns Formatted error message
 */
export function tokenErrorMessage(
  operation: string,
  tokenAddress: Address,
  details?: string,
): string {
  const baseMessage = `Failed to ${operation} for token ${tokenAddress}`;
  return details ? `${baseMessage}: ${details}` : baseMessage;
}

/**
 * Generate an error message for token balance operations
 * @param userAddress The user address
 * @param tokenAddress The token address
 * @returns Formatted error message
 */
export function balanceErrorMessage(
  userAddress: Address,
  tokenAddress: Address,
): string {
  return `Failed to get balance for address ${userAddress} of token ${tokenAddress}`;
}

/**
 * Generate an error message for token allowance operations
 * @param owner The owner address
 * @param spender The spender address
 * @param tokenAddress The token address
 * @returns Formatted error message
 */
export function allowanceErrorMessage(
  owner: Address,
  spender: Address,
  tokenAddress: Address,
): string {
  return `Failed to get allowance for owner ${owner} and spender ${spender} of token ${tokenAddress}`;
}

/**
 * Generate an error message for token approval operations
 * @param amount The amount to approve
 * @param spender The spender address
 * @param tokenAddress The token address
 * @returns Formatted error message
 */
export function approvalErrorMessage(
  amount: bigint,
  spender: Address,
  tokenAddress: Address,
): string {
  return `Failed to approve ${amount} tokens for spender ${spender} of token ${tokenAddress}`;
}

/**
 * Generate an error message for token transfer operations
 * @param amount The amount to transfer
 * @param recipient The recipient address
 * @param tokenAddress The token address
 * @returns Formatted error message
 */
export function transferErrorMessage(
  amount: bigint,
  recipient: Address,
  tokenAddress: Address,
): string {
  return `Failed to transfer ${amount} tokens to ${recipient} of token ${tokenAddress}`;
}

/**
 * Generate an error message for wallet operations
 * @param operation The operation that failed
 * @returns Formatted error message
 */
export function walletErrorMessage(operation: string): string {
  return `${operation}: No account connected to wallet client`;
}

/**
 * Generate an error message for L2 token operations
 * @param operation The operation that failed
 * @param tokenAddress The token address
 * @param details Additional details about the operation
 * @returns Formatted error message
 */
export function l2TokenErrorMessage(
  operation: string,
  tokenAddress: AztecAddress,
  details?: string,
): string {
  const baseMessage = `Failed to ${operation} for token ${tokenAddress}`;
  return details ? `${baseMessage}: ${details}` : baseMessage;
}

/**
 * Generate an error message for token balance operations on L2
 * @param userAddress The user address
 * @param tokenAddress The token address
 * @param balanceType The type of balance (public or private)
 * @returns Formatted error message
 */
export function l2BalanceErrorMessage(
  userAddress: AztecAddress,
  tokenAddress: AztecAddress,
  balanceType: 'public' | 'private',
): string {
  return `Failed to get ${balanceType} balance for address ${userAddress} of token ${tokenAddress}`;
}

/**
 * Generate an error message for token transfer operations on L2
 * @param amount The amount to transfer
 * @param recipient The recipient address
 * @param tokenAddress The token address
 * @param transferType The type of transfer (public or private)
 * @returns Formatted error message
 */
export function l2TransferErrorMessage(
  amount: bigint,
  recipient: AztecAddress,
  tokenAddress: AztecAddress,
  transferType: 'publicly' | 'privately',
): string {
  return `Failed to transfer ${amount} tokens ${transferType} to ${recipient} of token ${tokenAddress}`;
}

/**
 * Generate an error message for shield/unshield operations
 * @param operation The operation (shield or unshield)
 * @param amount The amount to shield/unshield
 * @param tokenAddress The token address
 * @returns Formatted error message
 */
export function shieldOperationErrorMessage(
  operation: 'shield' | 'unshield',
  amount: bigint,
  tokenAddress: AztecAddress,
): string {
  return `Failed to ${operation} ${amount} tokens of token ${tokenAddress}`;
}

/**
 * Generate an error message for burn operations
 * @param amount The amount to burn
 * @param from The address to burn from
 * @param tokenAddress The token address
 * @returns Formatted error message
 */
export function burnErrorMessage(
  amount: bigint,
  from: AztecAddress,
  tokenAddress: AztecAddress,
): string {
  return `Failed to create burn action for ${amount} tokens from ${from} of token ${tokenAddress}`;
}

/**
 * Generate an error message for token creation from address
 * @param address The token address
 * @returns Formatted error message
 */
export function tokenFromAddressErrorMessage(address: AztecAddress): string {
  return `Failed to create token from address ${address}`;
}

/**
 * Generate an error message for token deployment
 * @param name The token name
 * @param symbol The token symbol
 * @returns Formatted error message
 */
export function tokenDeployErrorMessage(name: string, symbol: string): string {
  return `Failed to deploy token with name ${name} and symbol ${symbol}`;
}
