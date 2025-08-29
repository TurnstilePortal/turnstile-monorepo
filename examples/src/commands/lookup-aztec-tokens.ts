import { TurnstileFactory } from '@turnstile-portal/turnstile.js';
import type { Command } from 'commander';

export function registerLookupAztecTokens(program: Command) {
  return program
    .command('lookup-aztec-tokens')
    .description('Obtains all registered tokens from Portal events')
    .action(async (_options, command) => {
      // Get global and local options together
      const allOptions = command.optsWithGlobals();
      if (!allOptions.configDir) {
        throw new Error(
          'Config directory is required. Use -c or --config-dir option.',
        );
      }

      // Load configuration from files
      const configDir = allOptions.configDir;
      const configPaths = await import('@turnstile-portal/deploy').then((m) =>
        m.getConfigPaths(configDir),
      );

      // Use the deployment data from config directory
      const factory = await TurnstileFactory.fromConfig(
        configPaths.deploymentFile,
      );

      // Get the mapping of tokens from the deployment data directly
      const tokens = factory.getDeploymentData().tokens;

      console.log(
        `Found ${Object.keys(tokens).length} tokens in deployment data:`,
      );

      for (const [symbol, tokenInfo] of Object.entries(tokens)) {
        // Convert addresses to proper format if they don't already have 0x prefix
        const l1Addr = tokenInfo.l1Address.startsWith('0x')
          ? tokenInfo.l1Address
          : `0x${tokenInfo.l1Address}`;
        const l2Addr = tokenInfo.l2Address.startsWith('0x')
          ? tokenInfo.l2Address
          : `0x${tokenInfo.l2Address}`;

        console.log(
          `Symbol: ${symbol}, L1 Address: ${l1Addr}, L2 Address: ${l2Addr}`,
        );
      }
    });
}

function _mod2hexlength(n: bigint): string {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }
  return hex;
}
