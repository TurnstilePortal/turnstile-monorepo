import {
  BatchCall,
  type Contract,
  type ContractFunctionInteraction,
  type DeployMethod,
  type DeployOptions,
  type SendMethodOptions,
  type SentTx,
  type SimulateMethodOptions,
  type Wallet,
} from '@aztec/aztec.js';
import type { ExecutionPayload } from '@aztec/entrypoints/payload';

/**
 * Type representing any call that can be added to a batch
 * Uses Contract as the generic type for DeployMethod since we support deploying any contract type
 */
export type BatchableCall = ContractFunctionInteraction | DeployMethod<Contract> | ExecutionPayload;

/**
 * Generic wrapper for contract function interactions that can be used
 * individually or batched together.
 */
export class ContractInteraction {
  protected interaction: ContractFunctionInteraction;

  constructor(interaction: ContractFunctionInteraction) {
    this.interaction = interaction;
  }

  /**
   * Gets the underlying ContractFunctionInteraction
   */
  getInteraction(): ContractFunctionInteraction {
    return this.interaction;
  }

  /**
   * Sends the transaction
   */
  send(options: SendMethodOptions): SentTx {
    return this.interaction.send(options);
  }

  /**
   * Simulates the transaction
   */
  simulate<T extends SimulateMethodOptions>(options?: T) {
    const opts = options || ({} as T);
    return this.interaction.simulate(opts);
  }

  /**
   * Creates an execution request
   */
  request(options?: SendMethodOptions): Promise<ExecutionPayload> {
    return this.interaction.request(options);
  }

  /**
   * Proves the transaction
   */
  prove(options: SendMethodOptions) {
    return this.interaction.prove(options);
  }
}

/**
 * Generic builder for creating batch contract transactions
 * Supports ContractFunctionInteraction, DeployMethod, and ExecutionPayload
 */
export class ContractBatchBuilder {
  protected wallet: Wallet;
  protected calls: BatchableCall[] = [];

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  /**
   * Adds an interaction to the batch
   * Supports ContractInteraction, ContractFunctionInteraction, DeployMethod, and ExecutionPayload
   *
   * @example
   * // Add a regular contract call (will use default options when sent)
   * batch.add(contract.methods.foo())
   *
   * @example
   * // Add with specific options using ExecutionPayload
   * const payload = await contract.methods.foo().request({ fee: someFeeOpts })
   * batch.add(payload)
   *
   * @example
   * // Add a deployment with specific options
   * const deployPayload = await Token.deploy().request({ universalDeploy: true, contractAddressSalt: salt })
   * batch.add(deployPayload)
   */
  add(call: ContractInteraction | BatchableCall): this {
    if (call instanceof ContractInteraction) {
      this.calls.push(call.getInteraction());
    } else {
      this.calls.push(call);
    }
    return this;
  }

  /**
   * Adds an ExecutionPayload to the batch
   * This is a convenience method for adding pre-built payloads with specific options
   *
   * @example
   * const payload = await contract.methods.foo().request({ fee: someFeeOpts })
   * batch.addPayload(payload)
   */
  addPayload(payload: ExecutionPayload): this {
    this.calls.push(payload);
    return this;
  }

  /**
   * Adds multiple interactions to the batch
   */
  addAll(calls: (ContractInteraction | BatchableCall)[]): this {
    for (const call of calls) {
      this.add(call);
    }
    return this;
  }

  /**
   * Gets the raw calls array
   */
  build(): BatchableCall[] {
    return this.calls;
  }

  /**
   * Creates execution payloads for all interactions
   * Note: DeployMethod calls may need DeployOptions rather than SendMethodOptions
   */
  async request(options?: SendMethodOptions | DeployOptions): Promise<ExecutionPayload[]> {
    const payloads: ExecutionPayload[] = [];
    for (const call of this.calls) {
      if ('request' in call && typeof call.request === 'function') {
        // It's a BaseContractInteraction (either ContractFunctionInteraction or DeployMethod)
        // We need to handle the case where options is undefined
        const requestOptions = options || {};

        // Type assertion needed here because TypeScript can't determine which specific
        // request method signature we're calling (DeployMethod vs ContractFunctionInteraction)
        const payload = await (call as ContractFunctionInteraction | DeployMethod<Contract>).request(
          requestOptions as DeployOptions & SendMethodOptions,
        );
        payloads.push(payload);
      } else {
        // It's already an ExecutionPayload
        payloads.push(call as ExecutionPayload);
      }
    }
    return payloads;
  }

  /**
   * Sends all interactions as a batch transaction
   *
   * @param options Options applied to the batch send. Note that if you need different
   * options for different interactions, create ExecutionPayloads with `.request(options)`
   * before adding them to the batch.
   *
   * @example
   * // Same options for all interactions
   * batch.add(contract.methods.foo()).add(contract.methods.bar()).send(commonOptions)
   *
   * @example
   * // Different options per interaction
   * const payload1 = await contract.methods.foo().request({ fee: highFee })
   * const payload2 = await contract.methods.bar().request({ fee: lowFee })
   * batch.add(payload1).add(payload2).send(baseOptions)
   */
  send(options: SendMethodOptions): SentTx {
    if (this.calls.length === 0) {
      throw new Error('No interactions to send in batch');
    }

    if (this.calls.length === 1) {
      // For single interaction, send directly if it's a BaseContractInteraction
      const firstCall = this.calls[0];
      if (!firstCall) {
        throw new Error('Invalid call at index 0');
      }
      if ('send' in firstCall && typeof firstCall.send === 'function') {
        return firstCall.send(options);
      }
      // If it's an ExecutionPayload, we need to wrap it in a BatchCall
      const batch = new BatchCall(this.wallet, [firstCall]);
      return batch.send(options);
    }

    // For multiple interactions, use BatchCall
    const batch = new BatchCall(this.wallet, this.calls);
    return batch.send(options);
  }

  /**
   * Simulates all interactions as a batch
   */
  async simulate<T extends SimulateMethodOptions>(options?: T) {
    if (this.calls.length === 0) {
      throw new Error('No interactions to simulate in batch');
    }

    if (this.calls.length === 1) {
      // For single interaction, simulate directly if it's a BaseContractInteraction
      const firstCall = this.calls[0];
      if (!firstCall) {
        throw new Error('Invalid call at index 0');
      }
      if ('simulate' in firstCall && typeof firstCall.simulate === 'function') {
        const opts = options || ({} as T);
        return firstCall.simulate(opts);
      }
      // If it's an ExecutionPayload, we need to wrap it in a BatchCall
      const batch = new BatchCall(this.wallet, [firstCall]);
      const opts = options || ({} as T);
      return batch.simulate(opts);
    }

    // For multiple interactions, use BatchCall
    const batch = new BatchCall(this.wallet, this.calls);
    const opts = options || ({} as T);
    return batch.simulate(opts);
  }

  /**
   * Proves all interactions as a batch
   */
  prove(options: SendMethodOptions) {
    if (this.calls.length === 0) {
      throw new Error('No interactions to prove in batch');
    }

    if (this.calls.length === 1) {
      // For single interaction, prove directly if it's a BaseContractInteraction
      const firstCall = this.calls[0];
      if (!firstCall) {
        throw new Error('Invalid call at index 0');
      }
      if ('prove' in firstCall && typeof firstCall.prove === 'function') {
        return firstCall.prove(options);
      }
      // If it's an ExecutionPayload, we need to wrap it in a BatchCall
      const batch = new BatchCall(this.wallet, [firstCall]);
      return batch.prove(options);
    }

    // For multiple interactions, use BatchCall
    const batch = new BatchCall(this.wallet, this.calls);
    return batch.prove(options);
  }

  /**
   * Gets the number of interactions in the batch
   */
  size(): number {
    return this.calls.length;
  }

  /**
   * Checks if the batch is empty
   */
  isEmpty(): boolean {
    return this.calls.length === 0;
  }

  /**
   * Clears all interactions from the batch
   */
  clear(): this {
    this.calls = [];
    return this;
  }
}
