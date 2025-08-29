import { getContract } from 'viem';
import type {
  GetContractReturnType,
  Client,
  Address,
} from 'viem';
import { RollupAbi } from '@aztec/l1-artifacts';
import { RollupCheatCodes } from '@aztec/aztec.js/testing';
import { EthCheatCodes } from '@aztec/ethereum/eth-cheatcodes';
import { EthAddress } from '@aztec/aztec.js';
import { type L1Client } from '@turnstile-portal/turnstile.js';

export type AztecRollupContract = GetContractReturnType<
  typeof RollupAbi,
  Client,
  Address
>;

export async function getAztecRollupContract(
  rollupAddr: Address,
  l1Client: L1Client,
): Promise<AztecRollupContract> {
  const walletClient = l1Client.getWalletClient();

  return getContract({
    address: rollupAddr,
    abi: RollupAbi,
    client: walletClient,
  });
}

/**
 * Set the `assumeProvenThroughBlockNumber` value in the Aztec Rollup contract
 * @param anvilURL The URL of the Anvil RPC server
 * @param rollupAddr Aztec Rollup contract address
 * @param l2BlockNumber The block number to set the `assumeProvenThroughBlockNumber` value to
 */
export async function setAssumeProven(
  anvilURL: string,
  rollupAddr: Address,
  l2BlockNumber: number,
) {
  const ethCheatCodes = new EthCheatCodes([anvilURL]);
  const rollupCheatCodes = new RollupCheatCodes(ethCheatCodes, { rollupAddress: EthAddress.fromString(rollupAddr) });
  await rollupCheatCodes.markAsProven(l2BlockNumber);
}
