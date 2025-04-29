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
  getClients,
  readDeploymentData,
  readKeyData,
} from '@turnstile-portal/turnstile-dev';

const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const PXE_URL = process.env.PXE_URL || 'http://localhost:8080';
const AZTEC_NODE_URL = process.env.AZTEC_NODE_URL || 'http://localhost:8080';

const pxe = createPXEClient(PXE_URL, {}, makeFetch([], true));
const node = createAztecNodeClient(AZTEC_NODE_URL);

export const l1PublicClient = createPublicClient({
  chain: anvil,
  transport: http(RPC_URL),
});

const parser = yargs(hideBin(process.argv))
  .scriptName('turnstile-repl')
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
  });

const argv = await parser.parse();

// Ensure we're using the correct paths when running with tsx
const deploymentDataPath =
  process.argv.includes('--deploymentData') || process.argv.includes('--dd')
    ? (argv.deploymentData as string)
    : 'sandbox_deployment.json';

const keyDataPath =
  process.argv.includes('--keyData') || process.argv.includes('--kd')
    ? (argv.keyData as string)
    : 'docker/turnstile-sandbox/sandbox-keys.json';

// Log the file paths we're trying to use
console.log('Using deployment data file:', deploymentDataPath);
console.log('Using key data file:', keyDataPath);

// Check if files exist before trying to read them
const { existsSync } = await import('node:fs');
if (!existsSync(deploymentDataPath)) {
  console.error(`Error: Deployment data file not found: ${deploymentDataPath}`);
  process.exit(1);
}

if (!existsSync(keyDataPath)) {
  console.error(`Error: Key data file not found: ${keyDataPath}`);
  process.exit(1);
}

const deploymentData = await readDeploymentData(deploymentDataPath);
const keyData = await readKeyData(keyDataPath);

const { l1Client, l2Client } = await getClients(
  AZTEC_NODE_URL,
  {
    chain: anvil,
    transport: http(RPC_URL),
  },
  keyDataPath,
);

const l2Tokens: Record<string, turnstilejs.L2Token> = {};
try {
  for (const token of Object.values(deploymentData.tokens)) {
    l2Tokens[token.symbol] = await turnstilejs.L2Token.fromAddress(
      aztecjs.AztecAddress.fromString(token.l2Address),
      l2Client,
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
    l2Client,
    l1Client,
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
  - l2Client: L2 client for interacting with Aztec contracts
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
