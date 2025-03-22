import type { Command } from 'commander';
import { existsSync, writeFileSync } from 'node:fs';
import { createPXEClient } from '@aztec/aztec.js';
import { parseEther } from 'viem';
import {
  generateAndDeployAztecAccountSchnorr,
  generateEthAccount,
  type KeyData,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from './common.js';

export function registerGenerateKey(program: Command) {
  return program
    .command('generate-key')
    .description('Generate a new private key')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.rpc)
    .action(async (options) => {
      if (existsSync(options.keys)) {
        console.error(
          `Key file ${options.keys} already exists. Use a different filename or delete the existing file.`,
        );
        process.exit(1);
      }

      const pxe = createPXEClient(options.pxe);
      const { privateKey: l1PrivateKey, address: l1Address } =
        generateEthAccount();
      const l2Account = await generateAndDeployAztecAccountSchnorr(pxe);

      const output: KeyData = {
        l1Address,
        l1PrivateKey,
        l2Address: l2Account.wallet.getAddress().toString(),
        l2EncKey: l2Account.encKey.toString(),
        l2SigningKey: l2Account.signingKey.toString(),
        l2Salt: l2Account.salt.toString(),
      };

      writeFileSync(options.keys, JSON.stringify(output, null, 2));
      console.log(`L1 Address: ${l1Address}`);
      console.log(`L2 Address: ${l2Account.wallet.getAddress()}`);
      console.log(`Generated new keys and saved to ${options.keys}`);
    });
}
