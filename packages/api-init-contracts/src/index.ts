#!/usr/bin/env node

import { AztecArtifactsApiClient, createDefaultClient } from '@aztec-artifacts/client';
import { Command } from 'commander';
import { config } from 'dotenv';
import { loadTurnstileContracts } from './loader.js';
import { logger } from './utils/logger.js';

config();

const program = new Command();

program
  .name('api-init-turnstile-contracts')
  .description('Initialize Turnstile contract artifacts and instances in the database')
  .version('0.0.13');

program
  .command('load')
  .description('Load Turnstile contract data into the database')
  .option('-u, --url <url>', 'Aztec Artifacts service URL override')
  .action(async (options) => {
    try {
      const client = options.url ? new AztecArtifactsApiClient({ baseUrl: options.url }) : createDefaultClient();
      logger.info('Starting Turnstile contract data loader...');
      const result = await loadTurnstileContracts(client);
      logger.info(result, 'Contract data loaded successfully');
      process.exit(0);
    } catch (error) {
      logger.error(error, 'Failed to load contract data');
      process.exit(1);
    }
  });

program.parse(process.argv);
