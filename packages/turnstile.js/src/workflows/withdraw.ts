import { ERC20TokenPortalABI } from '@turnstile-portal/l1-artifacts-abi';
import {
  encodeFunctionData,
  type Address,
  type Hex,
} from 'viem';
import { createError, ErrorCode } from '../errors.js';

export type PrepareWithdrawalParams = {
  portalAddress: Address;
  message: Hex;
  l2BlockNumber: number;
  leafIndex: bigint;
  siblingPath: readonly Hex[];
};

export type PreparedWithdrawal = {
  calldata: Hex;
  request: { to: Address; data: Hex; value: bigint };
};

export function withdrawToL1({
  portalAddress,
  message,
  l2BlockNumber,
  leafIndex,
  siblingPath,
}: PrepareWithdrawalParams): PreparedWithdrawal {
  if (!siblingPath.length) {
    throw createError(ErrorCode.VALIDATION_REQUIRED, 'Sibling path must contain at least one element', {
      l2BlockNumber,
      leafIndex: leafIndex.toString(),
    });
  }

  const calldata = encodeFunctionData({
    abi: ERC20TokenPortalABI,
    functionName: 'withdraw',
    args: [message, BigInt(l2BlockNumber), leafIndex, siblingPath],
  });

  return {
    calldata,
    request: { to: portalAddress, data: calldata, value: 0n },
  };
}
