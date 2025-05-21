import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { DeploySetup } from './setup-interface.js';
import type { DeployConfig } from '../config/types.js';
import { registerSetup } from './setup-interface.js';

const execAsync = promisify(exec);

export class LocalSandboxSetup implements DeploySetup {
  async setup(config: DeployConfig, keysFile: string): Promise<void> {
    console.log('Setting up sandbox environment...');
    await this.startOrResetSandbox();
    await this.waitForSandboxReady(config.connection.aztec.node);
  }

  private async getContainerIds(): Promise<string[]> {
    const { stdout } = await execAsync(
      'docker ps --filter name=aztec-start -q',
    );
    const containerIds = stdout
      .trim()
      .split('\n')
      .filter((id) => id);
    if (containerIds.length === 0) {
      throw new Error('No aztec-start container found');
    }

    return containerIds;
  }

  private async startOrResetSandbox(): Promise<void> {
    console.log('Checking the sandbox...');
    try {
      // await execAsync('docker-compose down -v');
      const containerIds = await this.getContainerIds();
      for (const containerId of containerIds) {
        await execAsync(`docker stop ${containerId}`);
        console.log(`Stopped existing sandbox container ${containerId}`);
      }
    } catch (error) {
      console.log('Container not running or not found, continuing...');
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
}

// Register the setup implementation
registerSetup('LocalSandboxSetup', new LocalSandboxSetup());
