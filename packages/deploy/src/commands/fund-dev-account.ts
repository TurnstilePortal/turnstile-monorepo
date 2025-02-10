import type { Command } from 'commander';

import { anvilFundMe, readKeyData } from '@turnstile-portal/turnstile-dev';

import { commonOpts } from './common.js';
import { parseEther } from 'viem';

export function registerFundDevAccount(program: Command) {
  return program
    .command('fund-dev-account')
    .description('Fund the dev account')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.rpc)
    .option('--amount <amount>', 'Amount to fund in ether', '100')
    .action(async (options) => {
      if (options.l1Chain !== 'anvil') {
        console.error('Only Anvil is supported for funding dev accounts');
        process.exit(1);
      }
      const keyData = await readKeyData(options.keys);
      await anvilFundMe(
        keyData.l1Address,
        parseEther(options.amount),
        options.rpc,
      );
    });
}
