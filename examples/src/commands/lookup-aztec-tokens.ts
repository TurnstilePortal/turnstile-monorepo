import type { Command } from 'commander';
import { readDeploymentData } from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

export function registerLookupAztecTokens(program: Command) {
  return program
    .command('lookup-aztec-tokens')
    .description('Obtains all registered tokens from Portal events')
    .addOption(commonOpts.deploymentData)
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);

      // Since the event API has changed, we'll need to look up the tokens another way
      // Get the mapping of tokens from the deployment data directly
      const tokens = deploymentData.tokens;

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

function mod2hexlength(n: bigint): string {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }
  return hex;
}
