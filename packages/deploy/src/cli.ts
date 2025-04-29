#!/usr/bin/env node

import { Command } from 'commander';
import { registerGenerateKey } from './commands/generate-key.js';
import { registerDeployTurnstileContracts } from './commands/deploy-turnstile-contracts.js';
import { registerDeployDevTokens } from './commands/deploy-dev-tokens.js';
import { registerDeployAztecKey } from './commands/deploy-aztec-key.js';
import { registerFundDevAccount } from './commands/fund-dev-account.js';
import { registerDeployAztecOnlyTokens } from './commands/deploy-aztec-only-tokens.js';
import { registerDeployCommand } from './commands/deploy-command.js';
import { registerAztecSandboxAdvanceBlocks } from './commands/aztec-sandbox-advance-blocks.js';

// Initialize setup modules
import './setup/index.js';

async function main() {
  const program = new Command();

  program
    .name('turnstile-deployer')
    .description('CLI tool for deploying turnstile contracts')
    .version('0.0.1');

  registerGenerateKey(program);
  registerDeployTurnstileContracts(program);
  registerDeployDevTokens(program);
  registerDeployAztecKey(program);
  registerFundDevAccount(program);
  registerDeployAztecOnlyTokens(program);
  registerDeployCommand(program);
  registerAztecSandboxAdvanceBlocks(program);

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
