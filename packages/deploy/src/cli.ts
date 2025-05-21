#!/usr/bin/env node

import { Command } from 'commander';
import { registerGenerateKey } from './commands/generate-key.js';
import { registerDeployAztecKey } from './commands/deploy-aztec-key.js';
import { registerDeployCommand } from './commands/deploy-command.js';

// Initialize setup modules
import './setup/index.js';

async function main() {
  const program = new Command();

  program
    .name('turnstile-deployer')
    .description('CLI tool for deploying turnstile contracts')
    .version('0.0.1');

  registerGenerateKey(program);
  registerDeployAztecKey(program);
  registerDeployCommand(program);

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
