import type { DeployConfig } from '../config/types.js';

export interface DeploySetup {
  /**
   * Run setup operations before deployment
   * @param config The full deployment configuration
   * @param keysFile The path to the keys file
   */
  setup(config: DeployConfig, keysFile: string): Promise<void>;
}

/**
 * Registry of available setup implementations
 */
export const setupRegistry: Record<string, DeploySetup> = {};

/**
 * Register a setup implementation
 */
export function registerSetup(name: string, implementation: DeploySetup): void {
  setupRegistry[name] = implementation;
}

/**
 * Get a setup implementation by name
 */
export function getSetup(name: string): DeploySetup | undefined {
  return setupRegistry[name];
}
