import type { AztecAddress, L2AmountClaim } from '@aztec/aztec.js';
import {
  createLogger,
  Fr,
  FunctionSelector,
  FunctionType,
  getContractInstanceFromDeployParams,
  L1FeeJuicePortalManager,
  ProtocolContractAddress,
  retryUntil,
  SentTx,
  SponsoredFeePaymentMethod,
} from '@aztec/aztec.js';
import { SPONSORED_FPC_SALT } from '@aztec/constants';
import { ExecutionPayload } from '@aztec/entrypoints/payload';
import type { ExtendedViemWalletClient } from '@aztec/ethereum';
import { InboxAbi } from '@aztec/l1-artifacts';
import { SponsoredFPCContract, SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getCanonicalFeeJuice } from '@aztec/protocol-contracts/fee-juice';
import { GasSettings } from '@aztec/stdlib/gas';
import type { BlockNumber, BlockTag } from 'viem';
import { publicActions } from 'viem';
import { ErrorCode, TurnstileError } from '../errors.js';
import type { L1Client } from '../l1/client.js';
import type { L2Client } from './client.js';

export async function getFeeJuiceFromFaucet(
  l1Client: L1Client,
  l2Client: L2Client,
  recipient: AztecAddress,
  amount = 1_000_000_000_000_000_000n, // Required value for sandbox
) {
  console.log(`Getting ${amount} fee juice from faucet to ${recipient}`);

  const claim = await bridgeL1FeeJuice(l1Client, l2Client, recipient, amount);
  await claimFeeJuiceOnL2(l2Client, claim);
}

export async function bridgeL1FeeJuice(
  l1Client: L1Client,
  l2Client: L2Client,
  recipient: AztecAddress,
  amount = 1_000_000_000_000_000_000n, // Required value for sandbox
) {
  console.log(`Bridging ${amount} fee juice from ${l1Client.getAddress().toString()} to ${recipient}`);

  const extendedClient = l1Client.getWalletClient().extend(publicActions) as unknown as ExtendedViemWalletClient;

  const portal = await L1FeeJuicePortalManager.new(
    l2Client.getWallet(),
    extendedClient,
    createLogger('turnstile.js:fee-utils'),
  );
  const claim = await portal.bridgeTokensPublic(recipient, amount, true /* mint */);

  const l2BlockNumber = await getFeeJuiceClaimL2BlockNumber(l1Client, l2Client, claim);

  console.log(`Waiting for L1->L2 message to be synced (L2 block number ${l2BlockNumber.toString()})...`);
  const isSynced = async () => {
    const currentBlockNumber = BigInt(await l2Client.getNode().getBlockNumber());
    console.log(`Current block number: ${currentBlockNumber.toString()}`);
    return currentBlockNumber >= l2BlockNumber;
  };
  await retryUntil(
    isSynced,
    `message ${claim.messageHash} sync to L2`,
    180 /* max time in seconds */,
    5 /* retry interval in seconds */,
  );

  return claim;
}

async function getFeeJuiceClaimL2BlockNumber(
  l1Client: L1Client,
  l2Client: L2Client,
  claim: L2AmountClaim,
  fromBlock: BlockNumber | BlockTag = 0n,
  toBlock: BlockNumber | BlockTag = 'latest',
): Promise<bigint> {
  const {
    l1ContractAddresses: { inboxAddress },
  } = await l2Client.getNode().getNodeInfo();

  if (inboxAddress.isZero()) {
    throw new TurnstileError(ErrorCode.L1_GENERAL, 'Aztec L1 Inbox address not found');
  }

  const filter = await l1Client.getPublicClient().createContractEventFilter({
    abi: InboxAbi,
    address: inboxAddress.toString(),
    eventName: 'MessageSent',
    args: { hash: claim.messageHash },
    fromBlock: fromBlock,
    toBlock: toBlock,
  });

  const logs = await l1Client.getPublicClient().getFilterLogs({ filter });
  if (logs.length === 0 || logs[0] === undefined || !logs[0].blockNumber) {
    throw new TurnstileError(
      ErrorCode.L1_GENERAL,
      `MessageSent event not found on inbox ${inboxAddress.toString()} between blocks ${fromBlock.toString()} and ${toBlock.toString()} for message hash ${claim.messageHash}`,
    );
  }
  console.debug(
    `MessageSent event found on inbox ${inboxAddress.toString()} at block ${logs[0].blockNumber.toString()} for message hash ${claim.messageHash}`,
  );
  return logs[0].blockNumber;
}

async function getFeeJuiceClaimSelector(_l2Client: L2Client) {
  const feeJuiceContract = await getCanonicalFeeJuice();
  const claimFunc = feeJuiceContract.artifact.functions.find((f) => f.name === 'claim');
  if (!claimFunc) {
    throw new TurnstileError(ErrorCode.L2_GENERAL, 'Claim function not found in FeeJuice contract');
  }
  return await FunctionSelector.fromNameAndParameters(claimFunc);
}

export async function getSponsoredFPCInstance() {
  return await getContractInstanceFromDeployParams(SponsoredFPCContract.artifact, { salt: new Fr(SPONSORED_FPC_SALT) });
}

export async function getSponsoredFPCAddress() {
  return (await getSponsoredFPCInstance()).address;
}

export async function registerSponsoredFPC(l2Client: L2Client) {
  const instance = await getSponsoredFPCInstance();
  await l2Client.getWallet().registerContract({ instance, artifact: SponsoredFPCContractArtifact });
}

export async function claimFeeJuiceOnL2(l2Client: L2Client, claim: L2AmountClaim) {
  console.log('Claiming fee juice on L2...');
  const selector = await getFeeJuiceClaimSelector(l2Client);

  const wallet = l2Client.getWallet();

  const payload = new ExecutionPayload(
    [
      {
        to: ProtocolContractAddress.FeeJuice,
        name: 'claim',
        selector,
        isStatic: false,
        args: [
          wallet.getAddress().toField(),
          new Fr(claim.claimAmount),
          claim.claimSecret,
          new Fr(claim.messageLeafIndex),
        ],
        returnTypes: [],
        type: FunctionType.PRIVATE,
      },
    ],
    [],
    [],
  );

  const paymentMethod = await new SponsoredFeePaymentMethod(await getSponsoredFPCAddress());
  const maxFeesPerGas = (await wallet.getCurrentBaseFees()).mul(1.5);
  console.log(`Max fees per gas: ${maxFeesPerGas.toString()}`);
  const gasSettings = GasSettings.default({ maxFeesPerGas });
  const feeOpts = { paymentMethod, gasSettings };

  console.log('Creating tx request...');
  const txRequest = await wallet.createTxExecutionRequest(payload, feeOpts, {} /* TxExecutionOptions */);
  console.log('Simulating tx...');
  const txSimulationResult = await wallet.simulateTx(txRequest, true /* simulatePublic */);
  console.log('Proving tx...');
  const txProvingResult = await wallet.proveTx(txRequest, txSimulationResult.privateExecutionResult);
  console.log('Sending tx...');
  const sentTx = new SentTx(wallet, async () => wallet.sendTx(txProvingResult.toTx()));
  console.log('Waiting for tx to be mined...');
  const receipt = await sentTx.wait();
  console.log(`Claimed fee juice in tx ${receipt.txHash.toString()}`);
}
