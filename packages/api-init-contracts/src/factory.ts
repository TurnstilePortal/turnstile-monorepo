import { type DeploymentData, type NetworkName, TurnstileFactory } from '@turnstile-portal/turnstile.js';

const NETWORK = (process.env.TURNSTILE_NETWORK as NetworkName) || 'sandbox';

// Lazy factory creation to avoid network calls at module load time
let factoryPromise: Promise<TurnstileFactory> | null = null;

function getFactory(): Promise<TurnstileFactory> {
  if (!factoryPromise) {
    factoryPromise = TurnstileFactory.fromConfig(NETWORK);
  }
  return factoryPromise;
}

// Allow injection of deployment data for testing
export function setDeploymentData(deploymentData: DeploymentData) {
  // Create a mock factory that returns the provided deployment data
  factoryPromise = Promise.resolve({
    getDeploymentData: () => deploymentData,
  } as TurnstileFactory);
}

// Reset factory for testing
export function resetFactory() {
  factoryPromise = null;
}

// Export factory function for other modules that need it
export function getFactoryPromise(): Promise<TurnstileFactory> {
  return getFactory();
}
