/** biome-ignore-all lint/suspicious/noExplicitAny: a number of the any's are unavoidable because we're extending stuff that isn't officially exported from aztec.js */
import {
  type AztecAddress,
  BatchCall,
  decodeFromAbi,
  type FeePaymentMethod,
  type Fr,
  FunctionType,
  type RequestMethodOptions,
  type SimulateMethodOptions,
  type Wallet,
} from '@aztec/aztec.js';
import type { UserFeeOptions } from '@aztec/entrypoints/interfaces';
import { ExecutionPayload, mergeExecutionPayloads } from '@aztec/entrypoints/payload';
import { GasSettings } from '@aztec/stdlib/gas';

/**
 * Interface for objects that can be used in batch calls.
 * This matches the shape of BaseContractInteraction without requiring the import.
 */
export interface ContractInteractionLike {
  request(options?: ExtendedRequestOptions): Promise<ExecutionPayload>;
}

/**
 * Extended request options that include fee payment method
 */
interface ExtendedRequestOptions extends RequestMethodOptions {
  fee?: UserFeeOptions & {
    paymentMethod?: FeePaymentMethod;
  };
}

/**
 * Extended simulate options with additional fields
 */
interface ExtendedSimulateOptions extends SimulateMethodOptions {
  skipTxValidation?: boolean;
}

/**
 * Type for utility call results
 */
interface UtilityCallResult {
  result: unknown;
}

/**
 * Extended BatchCall that accepts both contract interactions and raw ExecutionPayload objects.
 * This allows for more flexible batch operations without relying on pnpm patches.
 */
export class ExtendedBatchCall extends BatchCall {
  // Store the mixed array of interactions and payloads
  private interactions: (ContractInteractionLike | ExecutionPayload)[];

  constructor(wallet: Wallet, calls: (ContractInteractionLike | ExecutionPayload)[]) {
    // Filter out only ContractInteractionLike items for parent constructor
    const baseInteractions = calls.filter((c): c is ContractInteractionLike => 'request' in c);

    // Call parent with only ContractInteractionLike items
    super(wallet, baseInteractions as any);

    // Store all interactions including raw ExecutionPayloads
    this.interactions = calls;
  }

  /**
   * Override request to handle mixed interaction types and fee payment
   */
  override async request(options: RequestMethodOptions = {}): Promise<ExecutionPayload> {
    const executionPayloads = await this.getExecutionPayloads();
    const extendedOptions = options as ExtendedRequestOptions;

    // Handle fee payment method if provided
    const feeExecutionPayload = extendedOptions.fee?.paymentMethod
      ? await extendedOptions.fee.paymentMethod.getExecutionPayload(GasSettings.empty())
      : undefined;

    const finalExecutionPayload = feeExecutionPayload
      ? mergeExecutionPayloads([feeExecutionPayload, ...executionPayloads])
      : mergeExecutionPayloads(executionPayloads);

    return finalExecutionPayload;
  }

  /**
   * Override simulate to handle mixed interaction types
   */
  override async simulate(options: SimulateMethodOptions): Promise<unknown> {
    const executionPayloads = await this.getExecutionPayloads();
    const extendedOptions = options as ExtendedSimulateOptions;

    const { indexedExecutionPayloads, utility } = executionPayloads.reduce<{
      privateIndex: number;
      publicIndex: number;
      indexedExecutionPayloads: Array<[ExecutionPayload, number, number]>;
      utility: Array<[{ name: string; args: Fr[]; to: AztecAddress }, number]>;
    }>(
      (acc, current, index) => {
        const call = current.calls?.[0];
        if (!call) {
          return acc; // Skip if no calls
        }
        if (call.type === FunctionType.UTILITY) {
          acc.utility.push([call, index]);
        } else {
          acc.indexedExecutionPayloads.push([
            current,
            index,
            call.type === FunctionType.PRIVATE ? acc.privateIndex++ : acc.publicIndex++,
          ]);
        }
        return acc;
      },
      { privateIndex: 0, publicIndex: 0, indexedExecutionPayloads: [], utility: [] },
    );

    const payloads = indexedExecutionPayloads.map(([request]) => request);
    const combinedPayload = mergeExecutionPayloads(payloads);

    // Create execution payload with auth witnesses and capsules
    const requestWithoutFee = new ExecutionPayload(
      combinedPayload.calls,
      combinedPayload.authWitnesses.concat(options.authWitnesses ?? []),
      combinedPayload.capsules.concat(options.capsules ?? []),
      combinedPayload.extraHashedArgs,
    );

    const { fee: userFee, txNonce, cancellable } = options;

    // Access protected members via base class
    const batchCallBase = this as BatchCall;
    const fee = await (batchCallBase as any).getFeeOptions(requestWithoutFee, userFee, {});

    const txRequest = await (batchCallBase as any).wallet.createTxExecutionRequest(requestWithoutFee, fee, {
      txNonce,
      cancellable,
    });

    // Simulate utility calls
    const utilityCalls = utility.map(async ([call, index]) => [
      await (batchCallBase as any).wallet.simulateUtility(
        call.name,
        call.args,
        call.to,
        options.authWitnesses,
        options.from,
      ),
      index,
    ]);

    const [utilityResults, simulatedTx] = await Promise.all([
      Promise.all(utilityCalls),
      (batchCallBase as any).wallet.simulateTx(txRequest, true, extendedOptions.skipTxValidation, false),
    ]);

    const results: unknown[] = [];

    // Process utility results
    utilityResults.forEach((item) => {
      const [utilityResult, index] = item as [UtilityCallResult, number];
      results[index] = utilityResult.result;
    });

    // Process execution payload results
    indexedExecutionPayloads.forEach(([request, callIndex, resultIndex]) => {
      const call = request.calls?.[0];
      if (!call) {
        results[callIndex] = [];
        return;
      }
      const rawReturnValues =
        call.type === FunctionType.PRIVATE
          ? simulatedTx.getPrivateReturnValues()?.nested?.[resultIndex].values
          : simulatedTx.getPublicReturnValues()?.[resultIndex].values;

      results[callIndex] = rawReturnValues ? decodeFromAbi(call.returnTypes, rawReturnValues) : [];
    });

    return results;
  }

  /**
   * Get execution payloads from both ContractInteractionLike and raw ExecutionPayload objects
   */
  protected async getExecutionPayloads(): Promise<ExecutionPayload[]> {
    return await Promise.all(
      this.interactions.map((i) => {
        if ('request' in i) {
          // It's a ContractInteractionLike, call request()
          return i.request();
        }
        // It's already an ExecutionPayload
        return i;
      }),
    );
  }

  /**
   * Static factory method to create an ExtendedBatchCall
   */
  static create(wallet: Wallet, calls: (ContractInteractionLike | ExecutionPayload)[]): ExtendedBatchCall {
    return new ExtendedBatchCall(wallet, calls);
  }
}
