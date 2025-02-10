import type { Command } from 'commander';
import { createPXEClient } from '@aztec/aztec.js';
import { deployInitialTestAccounts } from '@aztec/accounts/testing';

import { commonOpts } from './common.js';

export function registerDeployDevAztecTestAccounts(program: Command) {
  return program
    .command('deploy-dev-aztec-test-accounts')
    .description('Deploy the initial test accounts for the Aztec network')
    .addOption(commonOpts.pxe)
    .action(async (options) => {
      const pxe = createPXEClient(options.pxe);
      await deployInitialTestAccounts(pxe);
    });
}
