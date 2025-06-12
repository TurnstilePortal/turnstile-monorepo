import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { anvil, sepolia, mainnet } from 'viem/chains';
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Account,
  type Chain,
  type Transport,
  type Hex,
} from 'viem';
import {
  createPXEClient,
  Fr,
  GrumpkinScalar,
  createAztecNodeClient,
  waitForNode,
  waitForPXE,
} from '@aztec/aztec.js';
import { createPXEService, getPXEServiceConfig } from '@aztec/pxe/server';
import { createStore } from '@aztec/kv-store/lmdb';
import type {
  AccountWallet,
  AztecAddress,
  AztecNode,
  PXE,
  Wallet as AztecWallet,
} from '@aztec/aztec.js';
import { getSchnorrAccount, getSchnorrWallet } from '@aztec/accounts/schnorr';
import { getDeployedTestAccountsWallets } from '@aztec/accounts/testing';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { L1Client, L2Client } from '@turnstile-portal/turnstile.js';

import { readKeyData, type KeyData } from './keyData.js';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

export async function createPXE(node: AztecNode): Promise<PXE> {
  const l1Contracts = await node.getL1ContractAddresses();
  const nodeInfo = await node.getNodeInfo();

  // Manually creating data store due to missing native bindings files
  // https://github.com/AztecProtocol/aztec-packages/issues/13904
  const store = await createStore('pxe', {
    dataDirectory: undefined, // ephemeral store
    dataStoreMapSizeKB: 1e6,
  });

  const config = getPXEServiceConfig();
  const fullConfig = {
    ...config,
    l1Contracts,
    l1ChainId: nodeInfo.l1ChainId,
    rollupVersion: nodeInfo.rollupVersion,
  };

  // TODO(twt): make this configurable so we can prove in sandbox when desired
  fullConfig.proverEnabled =
    nodeInfo.l1ChainId !== 31337 && nodeInfo.l1ChainId !== 1337;

  const pxe = await createPXEService(node, fullConfig, { store });
  console.log('Waiting for PXE service to be ready...');
  await waitForPXE(pxe);
  console.log('PXE service ready');
  return pxe;
}

export async function generateAndDeployAztecAccountSchnorr(pxe: PXE): Promise<{
  salt: Fr;
  secretKey: Fr;
  signingKey: GrumpkinScalar;
  wallet: AztecWallet;
}> {
  const { salt, secretKey, signingKey } =
    await generateAztecAccountSchnorr(pxe);
  const wallet = await deployAztecAccountSchnorr(
    pxe,
    secretKey,
    signingKey,
    salt,
  );
  return { salt, secretKey, signingKey, wallet };
}

export async function generateAztecAccountSchnorr(
  pxe: PXE,
): Promise<{ salt: Fr; secretKey: Fr; signingKey: GrumpkinScalar }> {
  const salt = Fr.random();
  const secretKey = Fr.random();
  const signingKey = deriveSigningKey(secretKey);
  return {
    salt,
    secretKey,
    signingKey,
  };
}

export async function deployAztecAccountSchnorr(
  pxe: PXE,
  secretKey: Fr,
  signingKey: GrumpkinScalar,
  salt: Fr,
): Promise<AztecWallet> {
  const deployWallet = (await getDeployedTestAccountsWallets(pxe))[0];
  const accountManager = await getSchnorrAccount(
    pxe,
    secretKey,
    signingKey,
    salt,
  );
  const wallet = await accountManager.deploy({ deployWallet }).getWallet();
  console.log(`Account deployed at ${wallet.getAddress()}`);
  return wallet;
}

export async function getAztecSchnorrAccountFromSigningKey(
  pxe: PXE,
  address: AztecAddress,
  signingKey: GrumpkinScalar,
): Promise<AccountWallet> {
  return getSchnorrWallet(pxe, address, signingKey);
}

export function generateEthAccount(): { privateKey: Hex; address: Hex } {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    privateKey,
    address: account.address,
  };
}

export async function getClients(
  aztecNode: string,
  l1Config: { chain: Chain; transport: Transport },
  keyDataFile: string,
): Promise<{
  l1Client: L1Client;
  l2Client: L2Client;
}> {
  const keyData = await readKeyData(keyDataFile);
  if (!keyData || !keyData.l1PrivateKey) {
    throw new Error(
      `Invalid keyData: missing l1PrivateKey in ${JSON.stringify(keyData)}`,
    );
  }

  return {
    l1Client: await createL1Client(l1Config, keyData),
    l2Client: await createL2Client(aztecNode, keyData),
  };
}

export async function createL1Client(
  l1Config: { chain: Chain; transport: Transport },
  keyData: KeyData,
): Promise<L1Client> {
  const l1Account: Account = privateKeyToAccount(keyData.l1PrivateKey);
  const l1WalletClient = createWalletClient({
    account: l1Account,
    chain: l1Config.chain,
    transport: l1Config.transport,
  });
  const l1PublicClient = createPublicClient({
    chain: l1Config.chain,
    transport: l1Config.transport,
  });

  return new L1Client(l1PublicClient, l1WalletClient);
}

export async function createL2Client(
  aztecNode: string,
  keyData: KeyData,
  pxe?: PXE,
): Promise<L2Client> {
  const node = createAztecNodeClient(aztecNode);
  console.log(`Connecting to Aztec Node at ${aztecNode}`);
  await waitForNode(node);
  console.log('Aztec Node is ready');
  if (!pxe) {
    // biome-ignore lint/style/noParameterAssign: only assigning if undefined
    pxe = await createPXE(node);
  }
  const account = await getSchnorrAccount(
    pxe,
    Fr.fromString(keyData.l2SecretKey),
    GrumpkinScalar.fromString(keyData.l2SigningKey),
    Fr.fromString(keyData.l2Salt),
  );
  const wallet = await account.register();
  const client = new L2Client(node, wallet);
  return client;
}

const devnet = defineChain({
  id: 1337,
  name: '',
  nativeCurrency: {
    name: '',
    symbol: '',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [],
      webSocket: undefined,
    },
  },
});

export function getChain(chain: string): Chain {
  switch (chain) {
    case 'mainnet':
      return mainnet;
    case 'sepolia':
      return sepolia;
    case 'anvil':
      return anvil;
    case 'devnet':
      return devnet;
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

export async function anvilFundMe(
  address: Hex,
  amount: bigint,
  rpcUrl: string,
) {
  const anvilKey =
    '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6';
  const anvilAccount = privateKeyToAccount(anvilKey);
  const anvilWallet = createWalletClient({
    account: anvilAccount,
    chain: anvil,
    transport: http(rpcUrl),
  });
  console.log(`Funding ${address} with ${amount} ETH...`);
  const receipt = await anvilWallet.sendTransaction({
    to: address,
    value: amount,
  });
  console.log(`Funded in tx ${receipt}`);
}

export async function startLocalPXE(
  nodeUrl: string,
  network: string | undefined,
  proverEnabled: boolean,
  port = 8976,
): Promise<PXE> {
  console.log('Starting local PXE...');

  const command = 'aztec';
  const args = [
    'start',
    '--port',
    port.toString(), // Convert port number to string
    '--pxe',
    '--pxe.nodeUrl',
    nodeUrl,
    '--pxe.proverEnabled',
    proverEnabled ? 'true' : 'false',
  ];
  if (network) {
    args.push('--pxe.network', network);
  }

  return new Promise<PXE>((resolve, reject) => {
    let pxeProcess: ChildProcess | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    let serverStarted = false;
    let accumulatedStdout = ''; // Accumulate stdout in case the message is split across chunks
    let accumulatedStderr = ''; // Accumulate stderr in case the message is split across chunks

    const cleanup = (killProcess = false) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pxeProcess) {
        pxeProcess.stdout?.removeAllListeners();
        pxeProcess.stderr?.removeAllListeners();
        pxeProcess.removeAllListeners('error');
        pxeProcess.removeAllListeners('close');
        if (killProcess && !pxeProcess.killed) {
          console.log('Attempting to kill PXE process...');
          const killed = pxeProcess.kill('SIGTERM'); // Attempt graceful shutdown
          if (!killed) {
            console.warn('Failed to send SIGTERM to PXE process.');
            // Consider SIGKILL if SIGTERM fails or after a delay
            setTimeout(() => {
              if (pxeProcess && !pxeProcess.killed) {
                pxeProcess.kill('SIGKILL');
              }
            }, 1000);
          }
        }
        pxeProcess = null; // Clear reference
      }
    };

    timeoutId = setTimeout(() => {
      if (!serverStarted) {
        console.error('PXE start timed out after 15 seconds.');
        cleanup(true); // Request process kill on timeout
        reject(
          new Error('Timeout: Failed to start PXE server within 15 seconds.'),
        );
      }
    }, 15000); // 15 seconds timeout

    try {
      console.log(`Spawning: ${command} ${args.join(' ')}`);
      pxeProcess = spawn(command, args as readonly string[], {
        env: { ...process.env, FORCE_COLOR: '0' }, // Ensure consistent output format
        stdio: ['ignore', 'pipe', 'pipe'], // Ignore stdin, pipe stdout, pipe stderr
      });

      pxeProcess?.stdout?.on('data', (data: Buffer) => {
        const outputChunk = data.toString();
        accumulatedStdout += outputChunk;
        console.log(`PXE stdout chunk: ${outputChunk.trim()}`); // Log chunk for debugging

        // Check for server listening message in stdout
        if (
          accumulatedStdout.includes('Aztec Server listening') &&
          !serverStarted
        ) {
          console.log(`PXE server started on port ${port}`);
          serverStarted = true;
          cleanup(false); // Don't kill the process, just clean up listeners/timeout

          // Create and return a PXE client with the specified port
          const pxe = createPXEClient(`http://localhost:${port}`);
          resolve(pxe);
        }
      });

      pxeProcess?.stderr?.on('data', (data: Buffer) => {
        const errorOutput = data.toString();
        accumulatedStderr += errorOutput;
        console.error(`PXE stderr: ${errorOutput.trim()}`);

        // Also check for server listening message in stderr
        if (
          accumulatedStderr.includes('Aztec Server listening') &&
          !serverStarted
        ) {
          console.log(`PXE server started on port ${port}`);
          serverStarted = true;
          cleanup(false); // Don't kill the process, just clean up listeners/timeout

          // Create and return a PXE client with the specified port
          const pxe = createPXEClient(`http://localhost:${port}`);
          resolve(pxe);
        }
      });

      pxeProcess?.on('error', (err) => {
        if (!serverStarted) {
          // Avoid rejection if server started just before error event
          console.error('Failed to start PXE process:', err);
          cleanup(true); // Kill process on spawn error
          reject(new Error(`Failed to start PXE process: ${err.message}`));
        }
      });

      pxeProcess?.on('close', (code, signal) => {
        // This might be called after the server started and cleanup already happened
        if (!serverStarted && pxeProcess) {
          // Check pxeProcess existence as cleanup sets it to null
          console.error(
            `PXE process exited unexpectedly with code ${code}, signal ${signal}`,
          );
          cleanup(false); // Don't try killing again, just cleanup listeners
          reject(
            new Error(
              `PXE process exited unexpectedly (code ${code}, signal ${signal}) before server started.`,
            ),
          );
        } else if (pxeProcess) {
          console.log(
            `PXE process exited (code ${code}, signal ${signal}) after server started or during cleanup.`,
          );
          // Process might have been killed by cleanup, which is expected in timeout/error cases.
        }
      });
    } catch (error) {
      // This catches synchronous errors during spawn setup
      console.error('Error setting up PXE process spawn:', error);
      cleanup(true); // Ensure cleanup if spawn fails synchronously
      reject(
        new Error(
          `Failed to spawn PXE process: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  });
}
