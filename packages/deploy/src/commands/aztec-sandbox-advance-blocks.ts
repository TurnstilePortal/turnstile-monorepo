import { type Command, Option } from 'commander';
import {
  createLogger,
  createPXEClient,
  retryUntil,
  waitForPXE,
  type Wallet,
} from '@aztec/aztec.js';
import { getInitialTestAccountsWallets } from '@aztec/accounts/testing';
import { TestContract } from '@aztec/noir-contracts.js/Test';
import { commonOpts } from './common.js';

export function registerAztecSandboxAdvanceBLocks(program: Command) {
  return program
    .command('aztec-sandbox-advance-blocks')
    .description('Sends transactions to advance blocks in the sandbox')
    .addOption(commonOpts.pxe)
    .addOption(
      new Option('--interval <interval>', 'Interval in seconds').default(30),
    )
    .addOption(
      new Option(
        '--timeout <time>',
        'Max run time in seconds (0 means forever)',
      ).default(0),
    )
    .action(async (options) => {
      const pxe = createPXEClient(options.pxe);
      const logger = createLogger(
        'turnstile-deploy:aztec-sandbox-advance-blocks',
      );
      logger.info('Waiting for PXE to be ready...');
      await waitForPXE(pxe, logger);

      let wallet: Wallet | undefined;

      const getWallet = async () => {
        const wallets = await getInitialTestAccountsWallets(pxe);
        logger.info(
          'Available accounts:',
          wallets.map((w) => w.getAddress().toString()),
        );
        wallet = wallets[2];
        if (!wallet) {
          logger.warn('No test account found, retrying...');
          logger.warn(
            'Available accounts:',
            wallets.map((w) => w.getAddress().toString()),
          );
          return false;
        }
        return true;
      };
      await retryUntil(getWallet, 'Get test account', 60, 5);

      if (!wallet) {
        throw new Error('No test account found');
      }

      logger.info(
        `Advancing blocks every ${options.interval} seconds using account ${wallet.getAddress().toString()}`,
      );

      const test = await TestContract.deploy(wallet)
        .send({ universalDeploy: true, skipClassRegistration: true })
        .deployed();

      const doTx = async () => {
        await test.methods.get_this_address().send().wait();
      };

      await retryUntil(
        doTx,
        'Advance blocks',
        options.timeout,
        options.interval,
      );
    });
}
