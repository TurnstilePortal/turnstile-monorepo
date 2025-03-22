import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import type { DeploySetup } from './setup-interface.js';
import type { AztecRollupAddresses, DeployConfig } from '../config/types.js';
import { registerSetup } from './setup-interface.js';
import {
  anvilFundMe,
  createL1Client,
  generateAndDeployAztecAccountSchnorr,
  generateEthAccount,
  getClients,
  type KeyData,
} from '@turnstile-portal/turnstile-dev';
import {
  createAztecNodeClient,
  createPXEClient,
  AztecAddress,
} from '@aztec/aztec.js';
import { anvil } from 'viem/chains';
import { http } from 'viem';
import { getFeeJuiceFromFaucet } from '@turnstile-portal/turnstile.js';

const execAsync = promisify(exec);
const composeProjectName = 'aztec-sandbox';

export class SandboxSetup implements DeploySetup {
  async setup(config: DeployConfig, keysFile: string): Promise<void> {
    console.log('Setting up sandbox environment...');
    await this.startOrResetSandbox();
    await this.waitForSandboxReady(config.connection.aztec.pxe);

    // Get the Aztec Rollup addresses from the sandbox container logs
    const addresses = await this.getAztecRollupAddresses(config);
    console.log('Aztec core addresses:', addresses);
    config.aztecRollupAddresses = addresses;

    // Generate and deploy the dev account
    console.log(`Generating new keys at: ${keysFile}`);
    const pxe = createPXEClient(config.connection.aztec.pxe);
    const l2Account = await generateAndDeployAztecAccountSchnorr(pxe);
    const l1Account = generateEthAccount();

    const keyData: KeyData = {
      l1Address: l1Account.address,
      l1PrivateKey: l1Account.privateKey,
      l2Address: l2Account.wallet.getAddress().toString(),
      l2EncKey: l2Account.encKey.toString(),
      l2SigningKey: l2Account.signingKey.toString(),
      l2Salt: l2Account.salt.toString(),
    };
    await fs.writeFile(keysFile, JSON.stringify(keyData, null, 2));

    // Fund the dev account
    await anvilFundMe(
      keyData.l1Address,
      1_000_000_000_000_000_000_000n,
      config.connection.ethereum.rpc,
    );

    // Bridge Fee Juice

    // Mnemonic:          test test test test test test test test test test test junk
    // Derivation path: m / 44'/60' / 0'/0/1
    const anvilKey =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

    const l1Config = {
      chain: anvil,
      transport: http(config.connection.ethereum.rpc),
    };
    const anvilL1Client = await createL1Client(l1Config, {
      l1PrivateKey: anvilKey,
    } as unknown as KeyData);

    const { l2Client } = await getClients(
      createAztecNodeClient(config.connection.aztec.node),
      pxe,
      l1Config,
      keysFile,
    );

    // TODO: currently this leaves out the `amount` parameter as the L1 contract requires minting a specific amount
    await getFeeJuiceFromFaucet(
      anvilL1Client,
      l2Client,
      AztecAddress.fromString(keyData.l2Address),
    );
  }

  private async startOrResetSandbox(): Promise<void> {
    console.log(`Checking the sandbox (${composeProjectName})...`);
    try {
      await execAsync('docker-compose down -v');
      // await execAsync(`docker stop ${composeProjectName}`);
      console.log('Stopped existing sandbox container');
    } catch (error) {
      console.log(`Container ${composeProjectName} not running, continuing...`);
    }

    console.log('Starting the sandbox...');
    try {
      // await execAsync('FORCE_COLOR=0 aztec start --sandbox > /dev/null 2>&1 &');
      await execAsync('docker-compose up -d');
      console.log('Started sandbox container');
    } catch (error) {
      throw new Error(`Failed to start sandbox: ${error}`);
    }
  }

  private async waitForSandboxReady(pxeUrl: string): Promise<void> {
    process.stdout.write('Waiting for the sandbox to start...');

    let count = 0;
    const maxRetries = 30;
    const delay = 2000; // 2 seconds

    while (count < maxRetries) {
      try {
        const response = await fetch(pxeUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: '1',
            method: 'pxe_getNodeInfo',
          }),
        });

        if (response.ok) {
          console.log('Sandbox is ready!');
          return;
        }
      } catch (error) {
        // Ignore errors and keep trying
      }

      process.stdout.write('.');
      count++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    throw new Error('Failed to start the sandbox');
  }

  /**
   * Extract Aztec Rollup addresses from the sandbox container logs
   */
  private async getAztecRollupAddresses(
    config: DeployConfig,
  ): Promise<AztecRollupAddresses> {
    console.log(
      `Extracting Aztec Rollup addresses from ${composeProjectName} logs...`,
    );

    try {
      // const { stdout } = await execAsync(
      //   `docker logs ${composeProjectName} 2>&1 | grep 'Aztec L1 contracts initialized' | grep -o '{.*}' | jq -r 'del(.severity)'`,
      // );

      const { stdout } = await execAsync(
        `docker-compose logs aztec 2>&1 | grep 'Aztec L1 contracts initialized' | grep -o '{.*}' | jq -r 'del(.severity)'`,
      );

      if (!stdout || stdout.trim() === '') {
        throw new Error('Could not find Aztec Rollup addresses in logs');
      }

      const addresses = JSON.parse(stdout.trim()) as AztecRollupAddresses;
      return addresses;
    } catch (error) {
      throw new Error(`Failed to extract Aztec Rollup addresses: ${error}`);
    }
  }
}

// Register the setup implementation
registerSetup('SandboxSetup', new SandboxSetup());
