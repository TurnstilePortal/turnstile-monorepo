import { ContractBatchBuilder, ContractInteraction } from './contract-interaction.js';

/**
 * Wrapper for token-specific contract function interactions that can be used
 * individually or batched together.
 */
export class L2TokenInteraction extends ContractInteraction {}

/**
 * Builder for creating batch token transactions with token-specific convenience methods
 */
export class L2TokenBatchBuilder extends ContractBatchBuilder {
  /**
   * Adds a transfer public operation to the batch
   */
  addTransferPublic(interaction: L2TokenInteraction): this {
    return this.add(interaction);
  }

  /**
   * Adds a transfer private operation to the batch
   */
  addTransferPrivate(interaction: L2TokenInteraction): this {
    return this.add(interaction);
  }

  /**
   * Adds a shield operation to the batch
   */
  addShield(interaction: L2TokenInteraction): this {
    return this.add(interaction);
  }

  /**
   * Adds an unshield operation to the batch
   */
  addUnshield(interaction: L2TokenInteraction): this {
    return this.add(interaction);
  }
}
