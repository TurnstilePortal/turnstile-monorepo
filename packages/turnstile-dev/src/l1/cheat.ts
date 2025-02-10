import { createWalletClient, getContract, http, publicActions } from 'viem';
import { anvil } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import type {
  WalletClient,
  GetContractReturnType,
  Client,
  Address,
  Transport,
  Chain,
  Account,
} from 'viem';
import { RollupAbi } from '@aztec/l1-artifacts';

export type AztecRollupContract = GetContractReturnType<
  typeof RollupAbi,
  Client,
  Address
>;

export async function getAztecRollupContract(
  rollupAddr: Address,
  client: WalletClient<Transport, Chain, Account>,
): Promise<AztecRollupContract> {
  return getContract({
    address: rollupAddr,
    abi: RollupAbi,
    client,
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
  l2BlockNumber: bigint,
) {
  // This is the private key of the account that deployed the Aztec Sandbox Rollup contracts
  const anvilKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  console.warn(
    `CHEATING: Setting assumeProvenThroughBlockNumber to ${l2BlockNumber}`,
  );

  const anvilAccount = privateKeyToAccount(anvilKey);
  const anvilWallet = createWalletClient({
    account: anvilAccount,
    chain: anvil,
    transport: http(anvilURL),
  });

  const rollup = await getAztecRollupContract(rollupAddr, anvilWallet);

  const tx = await rollup.write.setAssumeProvenThroughBlockNumber(
    [l2BlockNumber],
    {
      account: anvilWallet.account,
      chain: anvilWallet.chain,
    },
  );
  console.debug(
    `setAssumeProvenUntilBlockNumber(${l2BlockNumber}) tx hash:`,
    tx,
  );
  const receipt = await anvilWallet
    .extend(publicActions)
    .waitForTransactionReceipt({ hash: tx });
  if (receipt.status !== 'success') {
    throw new Error(`Failed assumeProvenUntilBlockNumber(${l2BlockNumber})`);
  }
  return tx;
}
