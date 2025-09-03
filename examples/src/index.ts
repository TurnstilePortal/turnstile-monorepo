#!/usr/bin/env node

import { Command } from 'commander';
import { registerAztecTransferPrivate } from './commands/aztec-transfer-private.js';
import { registerAztecTransferPublic } from './commands/aztec-transfer-public.js';
import { registerDeployAndRegisterToken } from './commands/deploy-and-register-token.js';
import { registerDepositAndClaim } from './commands/deposit-and-claim.js';
import { registerShieldTokens } from './commands/shield-tokens.js';
import { registerUnshieldTokens } from './commands/unshield-tokens.js';
import { registerWithdrawTokens } from './commands/withdraw-tokens.js';

async function main() {
  const program = new Command();

  program
    .name('turnstile-examples')
    .description('CLI tool for running turnstile example scripts')
    .version('0.0.2')
    .configureHelp({ showGlobalOptions: true })
    .requiredOption(
      '-c, --config-dir <directory>',
      'Config directory containing config.json, keys.json, and deployment.json',
    );

  registerDepositAndClaim(program);
  registerWithdrawTokens(program);
  registerShieldTokens(program);
  registerDeployAndRegisterToken(program);
  registerAztecTransferPrivate(program);
  registerAztecTransferPublic(program);
  registerUnshieldTokens(program);

  await program.parseAsync();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
