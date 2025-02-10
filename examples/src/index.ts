#!/usr/bin/env node

import { Command } from 'commander';
import { registerWithdrawTokens } from './commands/withdraw-tokens.js';
import { registerDepositAndClaim } from './commands/deposit-and-claim.js';
import { registerShieldTokens } from './commands/shield-tokens.js';
import { registerDeployAndRegisterToken } from './commands/deploy-and-register-token.js';
import { registerAztecTransferPrivateVerifiedID } from './commands/aztec-transfer-private-verified-id.js';
import { registerAztecTransferPrivateChannel } from './commands/aztec-transfer-private-channel.js';
import { registerAztecTransferPublic } from './commands/aztec-transfer-public.js';
import { registerUnshieldTokens } from './commands/unshield-tokens.js';
import { registerLookupAztecTokens } from './commands/lookup-aztec-tokens.js';

async function main() {
  const program = new Command();

  program
    .name('turnstile-examples')
    .description('CLI tool for running turnstile example scripts')
    .version('0.0.1');

  registerDepositAndClaim(program);
  registerWithdrawTokens(program);
  registerShieldTokens(program);
  registerDeployAndRegisterToken(program);
  registerAztecTransferPrivateVerifiedID(program);
  registerAztecTransferPrivateChannel(program);
  registerAztecTransferPublic(program);
  registerUnshieldTokens(program);
  registerLookupAztecTokens(program);

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
