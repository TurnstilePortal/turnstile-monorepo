#!/usr/bin/env node

import { start } from 'node:repl';
import path from 'node:path';
import * as turnstilejs from '@turnstile-portal/turnstile.js';
import * as turnstileAztecArtifacts from '@turnstile-portal/aztec-artifacts';
import * as aztecjs from '@aztec/aztec.js';
import * as viem from 'viem';
import { createAztecNodeClient, createPXEClient, Fr } from '@aztec/aztec.js';
import { createPublicClient, http } from 'viem';
import type { Account, Chain } from 'viem';
import { makeFetch } from '@aztec/aztec.js';

import { anvil } from 'viem/chains';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
  getWallets,
  readDeploymentData,
  readKeyData,
} from '@turnstile-portal/turnstile-dev';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PXE_URL = process.env.PXE_URL || 'http://localhost:8080';

const noRetryFetch = makeFetch([], true);
const pxe = createPXEClient(PXE_URL, noRetryFetch);
const node = createAztecNodeClient(PXE_URL, noRetryFetch);

export const l1PublicClient = createPublicClient({
  chain: anvil,
  transport: http(RPC_URL),
});

const argv = await yargs(hideBin(process.argv))
  .option('deploymentData', {
    alias: 'dd',
    type: 'string',
    description: 'Deployment Data',
    demandOption: true,
    default: 'sandbox_deployment.json',
  })
  .option('keyData', {
    alias: 'kd',
    type: 'string',
    description: 'Key Data',
    demandOption: true,
    default: 'docker/turnstile-sandbox/sandbox-keys.json',
  }).argv;

const deploymentData = await readDeploymentData(argv.deploymentData);
const keyData = await readKeyData(argv.keyData);

const { l1Wallet, l2Wallet } = await getWallets(
  pxe,
  {
    chain: anvil,
    transport: http(RPC_URL),
  },
  argv.keyData,
);

const l2Tokens: Record<string, turnstilejs.AztecToken> = {};
try {
  for (const token of Object.values(deploymentData.tokens)) {
    l2Tokens[token.symbol] = await turnstilejs.AztecToken.getToken(
      aztecjs.AztecAddress.fromString(token.l2Address),
      l2Wallet,
    );
  }
} catch (e) {
  console.error('Failed to load L2 tokens:', e);
}

function createREPL() {
  const historyFile = path.resolve(
    process.env.HOME || '.',
    '.turnstile_repl_history',
  );

  const r = start({
    prompt: '> ',
    useGlobal: true,
  });

  r.setupHistory(historyFile, (err) => {
    if (err) {
      console.error('Failed to load REPL history:', err);
    }
  });

  Object.assign(r.context, {
    turnstilejs,
    aztecjs,
    pxe,
    node,
    Fr,
    viem,
    deploymentData,
    keyData,
    l2Tokens,
    l2Wallet,
    l1Wallet,
    l1PublicClient,
    turnstileAztecArtifacts,
  });

  r.defineCommand('dd', {
    help: 'Display the deployment data',
    action() {
      console.log(deploymentData);
      this.displayPrompt();
    },
  });
  r.defineCommand('kd', {
    help: 'Display the key data',
    action() {
      console.log(keyData);
      this.displayPrompt();
    },
  });
  r.defineCommand('turnstile', {
    help: 'Display information about Turnstile REPL default imports',
    action() {
      console.log(`
Default imports available in this environment:
  - turnstilejs: @turnstile-portal/turnstile.js
  - aztecjs: @aztec/aztec.js
  - pxe: PXE client (createPXEClient)
  - node: Aztec Node client (createAztecNodeClient)
  - Fr: Field element from @aztec/aztec.js
  - viem: viem client
  - deploymentData: Data loaded from the deployment data file
  - keyData: Data loaded from the key data file
  - l2Wallet: Wallet client for the L2 account
  - l1Wallet: Wallet client for the L1 account
  - l1PublicClient: Public client for the L1 chain
  - turnstileAztecArtifacts: @turnstile-portal/aztec-artifacts
  - l2Tokens: L2 tokens loaded from the deployment data

You can use these imported modules and objects directly in your REPL session.
      `);
      this.displayPrompt();
    },
  });
}

console.log(
  'Turnstile REPL environment loaded. Type .help for custom commands.',
);
console.log('');
createREPL();
