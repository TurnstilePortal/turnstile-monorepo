import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { DeploySetup } from './setup-interface.js';
import type { AztecRollupAddresses, DeployConfig } from '../config/types.js';
import { registerSetup } from './setup-interface.js';

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
  }

  private async startOrResetSandbox(): Promise<void> {
    console.log(`Checking the sandbox (${composeProjectName})...`);
    try {
      // await execAsync('docker-compose down -v');
      await execAsync(`docker stop ${composeProjectName}`);
      console.log('Stopped existing sandbox container');
    } catch (error) {
      console.log(`Container ${composeProjectName} not running, continuing...`);
    }

    console.log('Starting the sandbox...');
    try {
      await execAsync('FORCE_COLOR=0 aztec start --sandbox > /dev/null 2>&1 &');
      // await execAsync('docker-compose up -d');
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
      const { stdout } = await execAsync(
        `docker logs ${composeProjectName} 2>&1 | grep 'Aztec L1 contracts initialized' | grep -o '{.*}' | jq -r 'del(.severity)'`,
      );

      // const { stdout } = await execAsync(
      //   `docker-compose logs aztec 2>&1 | grep 'Aztec L1 contracts initialized' | grep -o '{.*}' | jq -r 'del(.severity)'`,
      // );

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
