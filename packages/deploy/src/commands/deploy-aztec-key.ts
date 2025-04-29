import type { Command } from 'commander';
import { Fq, Fr, createPXEClient } from '@aztec/aztec.js';
import {
  deployAztecAccountSchnorr,
  readKeyData,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from './common.js';

export function registerDeployAztecKey(program: Command) {
  return program
    .command('deploy-aztec-key')
    .description('Deploys an Aztec account from exiting key material')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .action(async (options) => {
      const kd = await readKeyData(options.keys);

      const pxe = createPXEClient(options.pxe);
      const l2Account = await deployAztecAccountSchnorr(
        pxe,
        Fr.fromHexString(kd.l2EncKey),
        Fq.fromHexString(kd.l2SecretKey),
        Fr.fromHexString(kd.l2Salt),
      );

      console.log(`Deployed L2 account at ${l2Account.getAddress()}`);
    });
}
