#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import { destroyDatabase } from './db.js';
import { loadTurnstileContracts } from './loader.js';

config();

const program = new Command();

program
  .name('api-init-turnstile-contracts')
  .description('Initialize Turnstile contract artifacts and instances in the database')
  .version('0.0.13');

program
  .command('load')
  .description('Load Turnstile contract data into the database')
  .option('-u, --database-url <url>', 'Database URL (overrides DATABASE_URL env var)')
  .action(async (options) => {
    try {
      if (options.databaseUrl) {
        process.env.DATABASE_URL = options.databaseUrl;
      }

      console.log('Starting Turnstile contract data loader...');
      const result = await loadTurnstileContracts();
      console.log('✅ Contract data loaded successfully:', result);
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to load contract data:', error);
      process.exit(1);
    } finally {
      await destroyDatabase().catch(console.error);
    }
  });

program.parse(process.argv);
