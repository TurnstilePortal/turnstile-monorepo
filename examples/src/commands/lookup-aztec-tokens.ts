import type { Command } from 'commander';
import { createPXEClient, EthAddress, AztecAddress } from '@aztec/aztec.js';
import {
  getL2Wallet,
  readDeploymentData,
  readKeyData,
} from '@turnstile-portal/turnstile-dev';

import { commonOpts } from '@turnstile-portal/deploy/commands';

import { AztecTokenPortal } from '@turnstile-portal/turnstile.js';

import { PortalContract } from '@turnstile-portal/aztec-artifacts';

export function registerLookupAztecTokens(program: Command) {
  return program
    .command('lookup-aztec-tokens')
    .description('Obtains all registered tokens from Portal events')
    .addOption(commonOpts.keys)
    .addOption(commonOpts.pxe)
    .addOption(commonOpts.l1Chain)
    .addOption(commonOpts.rpc)
    .addOption(commonOpts.deploymentData)
    .action(async (options) => {
      const deploymentData = await readDeploymentData(options.deploymentData);
      const pxe = createPXEClient(options.pxe);
      const l2Wallet = await getL2Wallet(pxe, await readKeyData(options.keys));

      const aztecPortalAddr = deploymentData.aztecPortal;

      const aztecPortal = new AztecTokenPortal(aztecPortalAddr, pxe, l2Wallet);

      const events = await aztecPortal.getPublicEvents<{
        eth_token: { inner: bigint };
        aztec_token: bigint;
      }>(PortalContract.events.Register);
      for (const event of events) {
        const ethHex = mod2hexlength(event.eth_token.inner);
        const aztecHex = mod2hexlength(event.aztec_token);
        const ethAddr = EthAddress.fromString(`0x${ethHex}`);
        const aztecAddr = AztecAddress.fromString(`0x${aztecHex}`);
        console.log(
          `L1 Address: ${ethAddr.toString()}, L2 Address: ${aztecAddr.toString()}`,
        );
      }
    });
}

function mod2hexlength(n: bigint): string {
  let hex = n.toString(16);
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`;
  }
  return hex;
}
