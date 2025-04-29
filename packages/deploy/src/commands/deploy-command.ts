/**
 * Unified deploy command
 */
import type { Command } from 'commander';
import { existsSync, promises as fs } from 'node:fs';
import {
  getConfigPaths,
  ensureConfigDirectory,
  loadDeployConfig,
  createDefaultConfig,
} from '../config/config-loader.js';
import type { DeployConfig } from '../config/types.js';
import { createAztecNodeClient } from '@aztec/aztec.js';
import { http } from 'viem';
import {
  readDeploymentData,
  writeDeploymentData,
  getChain,
  getClients,
  type DeploymentData,
} from '@turnstile-portal/turnstile-dev';
import { deployTurnstileContracts } from '../lib/deployment.js';
import { deployTokens } from '../lib/tokens.js';
import { getSetup, setupRegistry } from '../setup/index.js';

export function registerDeployCommand(program: Command) {
  return program
    .command('deploy')
    .description('Deploy Turnstile contracts with specified config')
    .requiredOption(
      '-c, --config-dir <directory>',
      'Config directory containing config.json, keys.json, etc.',
    )
    .option('-o, --overwrite', 'Overwrite existing deployments and keys', false)
    .action(async (options) => {
      try {
        console.log(
          `Starting deployment using config directory: ${options.configDir}`,
        );

        // Setup config paths
        const configPaths = getConfigPaths(options.configDir);
        await ensureConfigDirectory(options.configDir);

        // Check if config exists, create if needed
        if (!existsSync(configPaths.configFile)) {
          console.log(
            `Config file not found, creating default: ${configPaths.configFile}`,
          );
          await createDefaultConfig(configPaths.configFile, {
            name: 'Default Environment',
            setup: 'LocalSandboxSetup', // Use sandbox setup by default
          });
        }

        // Load configuration
        const config = await loadDeployConfig(configPaths.configFile);

        // Command line options override config
        if (options.overwrite !== undefined) {
          config.deployment.overwrite = options.overwrite;
        }

        console.log(`Using configuration from: ${configPaths.configFile}`);

        // Check if we should respect existing deployment
        const deploymentExists = existsSync(configPaths.deploymentFile);
        if (deploymentExists && !config.deployment.overwrite) {
          console.log(
            `Deployment data exists at ${configPaths.deploymentFile} and overwrite is disabled. Exiting.`,
          );
          return;
        }

        // Run setup if specified in config
        if (config.setup) {
          console.log(`Setup class specified in config: "${config.setup}"`);
          const setup = getSetup(config.setup);
          if (!setup) {
            console.warn(
              `Warning: Setup "${config.setup}" specified but not found in registry`,
            );
            console.log(
              'Available setup implementations:',
              Object.keys(setupRegistry).join(', ') || 'None',
            );
          } else {
            console.log(`Running setup: ${config.setup}`);
            await setup.setup(config, configPaths.keysFile);
          }
        } else {
          console.log('No setup class specified in config');
        }

        // Sanity check: ensure key file exists
        const keyFileExists = existsSync(configPaths.keysFile);
        if (!keyFileExists) {
          throw new Error(`Key file not found: ${configPaths.keysFile}`);
        }

        // Handle deployment
        await runDeployment(config, configPaths);

        console.log('Deployment completed successfully!');
        console.log(`- Configuration: ${configPaths.configFile}`);
        console.log(`- Keys: ${configPaths.keysFile}`);
        console.log(`- Deployment data: ${configPaths.deploymentFile}`);
      } catch (error) {
        console.error('Deployment failed:', error);
        process.exit(1);
      }
    });
}

/**
 * Run the deployment process
 */
async function runDeployment(
  config: DeployConfig,
  paths: { keysFile: string; deploymentFile: string },
): Promise<void> {
  console.log(`Connecting to Aztec Node at ${config.connection.aztec.node}`);
  const node = createAztecNodeClient(config.connection.aztec.node);

  // Initialize clients
  const { l1Client, l2Client } = await getClients(
    node,
    {
      chain: getChain(config.connection.ethereum.chainName),
      transport: http(config.connection.ethereum.rpc),
    },
    paths.keysFile,
  );

  console.log(`L1 Address: ${l1Client.getAddress()}`);
  console.log(`L2 Address: ${l2Client.getAddress()}`);

  const deploymentExists = existsSync(paths.deploymentFile);

  // Load existing deployment data or create new
  let deploymentData: Partial<DeploymentData> = {};
  if (deploymentExists && !config.deployment.overwrite) {
    try {
      deploymentData = await readDeploymentData(paths.deploymentFile);
      console.log(
        `Loaded existing deployment data from ${paths.deploymentFile}`,
      );
    } catch (error) {
      console.log(`Error reading deployment data, starting fresh: ${error}`);
    }
  }

  const l1Addresses = await node.getL1ContractAddresses();
  const registryAddress = l1Addresses.registryAddress.toString();

  // Deploy Turnstile contracts
  console.log('Deploying Turnstile contracts...');
  const deploymentResult = await deployTurnstileContracts(l1Client, l2Client, {
    registryAddress,
  });

  // Update deployment data
  const updatedData: Partial<DeploymentData> = {
    ...deploymentData,
    l1AllowList: deploymentResult.l1AllowList,
    l1Portal: deploymentResult.l1Portal,
    aztecTokenContractClassID: deploymentResult.aztecTokenContractClassID,
    aztecPortal: deploymentResult.aztecPortal as `0x${string}`,
    aztecShieldGateway: deploymentResult.aztecShieldGateway as `0x${string}`,
  };

  // Save after contract deployment
  await writeDeploymentData(
    paths.deploymentFile,
    updatedData as DeploymentData,
  );

  // Check if tokens should be deployed
  const hasTokens = Object.keys(config.deployment.tokens).length > 0;
  if (hasTokens && updatedData.aztecPortal) {
    console.log('Deploying tokens...');
    if (!updatedData.tokens) {
      updatedData.tokens = {};
    }

    // Deploy tokens
    const tokenResults = await deployTokens(
      l1Client,
      l2Client,
      updatedData.aztecPortal as `0x${string}`,
      config.deployment.tokens,
    );

    // Update token data in deployment file
    for (const [symbol, result] of Object.entries(tokenResults)) {
      if (!updatedData.tokens) updatedData.tokens = {};
      updatedData.tokens[symbol] = {
        name: result.name,
        symbol: result.symbol,
        decimals: result.decimals,
        l1Address: result.l1Address,
        l2Address: result.l2Address,
      };
    }

    // Save updated deployment with tokens
    await writeDeploymentData(
      paths.deploymentFile,
      updatedData as DeploymentData,
    );
  }
}
