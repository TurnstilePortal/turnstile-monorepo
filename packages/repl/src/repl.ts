#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';
import { start } from 'node:repl';
import * as aztecjs from '@aztec/aztec.js';
import { createAztecNodeClient, Fr } from '@aztec/aztec.js';
import { SerializableContractInstance } from '@aztec/stdlib/contract';
import * as turnstileAztecArtifacts from '@turnstile-portal/aztec-artifacts';
import * as turnstilejs from '@turnstile-portal/turnstile.js';
import { getClients, readKeyData } from '@turnstile-portal/turnstile-dev';
import { Command } from 'commander';
import * as viem from 'viem';
import { createPublicClient, http } from 'viem';
import { anvil } from 'viem/chains';

async function main() {
  const program = new Command();

  program
    .name('turnstile-repl')
    .description('Turnstile REPL environment')
    .version('0.2.3')
    .option(
      '-d, --deployment-data <path>',
      'Path to deployment data file',
      'config/sandbox-hosted/deployment.json',
    )
    .option(
      '-k, --key-data <path>',
      'Path to key data file',
      'config/sandbox-hosted/keys.json',
    )
    .option(
      '--eth-rpc <url>',
      'Ethereum RPC URL',
      'https://sandbox.ethereum.walletmesh.com/api/v1/public',
    )
    .option(
      '--aztec-node <url>',
      'Aztec Node URL',
      'https://sandbox.aztec.walletmesh.com/api/v1/public',
    );

  program.parse();
  const options = program.opts();

  const deploymentDataPath = options.deploymentData;
  const keyDataPath = options.keyData;
  const ethRpcUrl = options.ethRpc;
  const aztecNodeUrl = options.aztecNode;

  // Log the configuration we're using
  console.log('Using deployment data file:', deploymentDataPath);
  console.log('Using key data file:', keyDataPath);
  console.log('Using Ethereum RPC:', ethRpcUrl);
  console.log('Using Aztec Node:', aztecNodeUrl);

  // Check if files exist before trying to read them
  if (!existsSync(deploymentDataPath)) {
    console.error(
      `Error: Deployment data file not found: ${deploymentDataPath}`,
    );
    process.exit(1);
  }

  if (!existsSync(keyDataPath)) {
    console.error(`Error: Key data file not found: ${keyDataPath}`);
    process.exit(1);
  }

  // Use the new configuration system
  const factory =
    await turnstilejs.TurnstileFactory.fromConfig(deploymentDataPath);
  const deploymentData = factory.getDeploymentData();
  const keyData = await readKeyData(keyDataPath);

  const node = createAztecNodeClient(aztecNodeUrl);

  const l1PublicClient = createPublicClient({
    chain: anvil,
    transport: http(ethRpcUrl),
  });

  const { l1Client, l2Client } = await getClients(
    {
      node: aztecNodeUrl,
    },
    {
      chain: anvil,
      transport: http(ethRpcUrl),
    },
    keyDataPath,
  );

  const pxe = l2Client.getPXE();

  // Register contract classes with the PXE
  await l2Client
    .getWallet()
    .registerContractClass(turnstileAztecArtifacts.TokenContractArtifact);
  await l2Client
    .getWallet()
    .registerContractClass(turnstileAztecArtifacts.PortalContractArtifact);

  // Register the Shield Gateway & L2 Portal contract instances with the PXE
  const instance = SerializableContractInstance.fromBuffer(
    Buffer.from(deploymentData.serializedAztecPortalInstance.slice(2), 'hex'),
  ).withAddress(aztecjs.AztecAddress.fromString(deploymentData.aztecPortal));
  await pxe.registerContract({
    instance,
    artifact: turnstileAztecArtifacts.PortalContractArtifact,
  });
  console.log(
    `Registered L2 Portal at ${deploymentData.aztecPortal} in PXE for wallet ${l2Client.getWallet().getAddress()}`,
  );
  const l2Portal = new turnstilejs.L2Portal(
    aztecjs.AztecAddress.fromString(deploymentData.aztecPortal),
    l2Client,
  );

  const shieldGatewayInstance = SerializableContractInstance.fromBuffer(
    Buffer.from(deploymentData.serializedShieldGatewayInstance.slice(2), 'hex'),
  ).withAddress(
    aztecjs.AztecAddress.fromString(deploymentData.aztecShieldGateway),
  );
  await pxe.registerContract({
    instance: shieldGatewayInstance,
    artifact: turnstileAztecArtifacts.ShieldGatewayContractArtifact,
  });
  console.log(
    `Registered Shield Gateway at ${deploymentData.aztecShieldGateway} in PXE for wallet ${l2Client.getWallet().getAddress()}`,
  );

  const l2Tokens: Record<string, turnstilejs.L2Token> = {};
  try {
    for (const token of Object.values(deploymentData.tokens)) {
      const l2TokenAddr = aztecjs.AztecAddress.fromString(token.l2Address);
      // Ensure the token is registered in the wallet's PXE
      const instance = SerializableContractInstance.fromBuffer(
        Buffer.from(token.serializedL2TokenInstance.slice(2), 'hex'),
      ).withAddress(l2TokenAddr);
      await l2Client.getWallet().registerContract({
        instance,
        artifact: turnstileAztecArtifacts.TokenContractArtifact,
      });
      console.log(
        `Registered L2 token ${token.symbol} at ${token.l2Address} in PXE for wallet ${l2Client.getWallet().getAddress()}`,
      );

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
      l2Portal,
      l2Client,
      l1Client,
      l1PublicClient,
      turnstileAztecArtifacts,
      factory,
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
}

main().catch((error) => {
  console.error('Failed to start REPL:', error);
  process.exit(1);
});
