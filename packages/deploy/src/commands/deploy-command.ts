/**
 * Unified deploy command
 */
import type { Command } from 'commander';
import { existsSync, promises as fs, write } from 'node:fs';
import {
  getConfigPaths,
  ensureConfigDirectory,
  loadDeployConfig,
  createDefaultConfig,
} from '../config/config-loader.js';
import type { DeployConfig, DeploymentResult } from '../config/types.js';
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
import { deployTokens, deployToken } from '../lib/tokens.js';
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

        // Check if deployment file exists
        const deploymentExists = existsSync(configPaths.deploymentFile);
        if (deploymentExists) {
          console.log(
            `Found existing deployment data at ${configPaths.deploymentFile}`,
          );
          if (config.deployment.overwrite) {
            console.log('Overwrite enabled: Will redeploy all components');
          } else {
            console.log(
              'Overwrite disabled: Will continue any incomplete deployments',
            );
          }
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
  console.log(`Using Aztec Node at ${config.connection.aztec.node}`);

  // Initialize clients
  const { l1Client, l2Client } = await getClients(
    config.connection.aztec.node,
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
  if (deploymentExists) {
    try {
      deploymentData = await readDeploymentData(paths.deploymentFile);
      console.log(
        `Loaded existing deployment data from ${paths.deploymentFile}`,
      );
    } catch (error) {
      console.log(`Error reading deployment data, starting fresh: ${error}`);
    }
  }

  const node = createAztecNodeClient(config.connection.aztec.node);
  const l1Addresses = await node.getL1ContractAddresses();
  const registryAddress = l1Addresses.registryAddress.toString();

  // Check if we need to deploy or complete a partial deployment
  const needsFullDeployment =
    config.deployment.overwrite || !deploymentData.l1Portal;
  const isPartialDeployment =
    deploymentData.l1Portal && !deploymentData.aztecPortal;

  if (needsFullDeployment || isPartialDeployment) {
    if (needsFullDeployment) {
      console.log('Starting fresh deployment of all Turnstile contracts...');
    } else if (isPartialDeployment) {
      console.log(
        'Found partial deployment (L1 only). Completing L2 deployment...',
      );
    }

    // Start or continue the deployment process
    console.log(
      isPartialDeployment
        ? 'Continuing deployment with existing L1 contracts...'
        : 'Deploying L1 contracts...',
    );
    const deploymentResult = await deployTurnstileContracts(
      l1Client,
      l2Client,
      { registryAddress },
      deploymentData as Partial<DeploymentResult>,
    );

    // Check if we got a partial result (only L1 deployed)
    const isL1OnlyResult =
      deploymentResult.aztecPortal ===
      '0x0000000000000000000000000000000000000000';

    if (isL1OnlyResult) {
      console.log(
        'L1 contracts deployed successfully. Saving intermediate state...',
      );
      // Update deployment data with L1 contract addresses
      deploymentData = {
        ...deploymentData,
        l1AllowList: deploymentResult.l1AllowList,
        l1Portal: deploymentResult.l1Portal,
      };

      // Save after L1 deployment
      await writeDeploymentData(
        paths.deploymentFile,
        deploymentData as DeploymentData,
      );

      // Continue with L2 deployment
      console.log('Proceeding with L2 contract deployment...');
      const completeResult = await deployTurnstileContracts(
        l1Client,
        l2Client,
        { registryAddress },
        deploymentData as Partial<DeploymentResult>,
      );

      // Update with complete deployment data
      deploymentData = {
        ...deploymentData,
        aztecTokenContractClassID: completeResult.aztecTokenContractClassID,
        aztecPortal: completeResult.aztecPortal,
        aztecShieldGateway: completeResult.aztecShieldGateway,
      };
    } else {
      // We got a complete result in one go
      deploymentData = {
        ...deploymentData,
        l1AllowList: deploymentResult.l1AllowList,
        l1Portal: deploymentResult.l1Portal,
        aztecTokenContractClassID: deploymentResult.aztecTokenContractClassID,
        aztecPortal: deploymentResult.aztecPortal,
        aztecShieldGateway: deploymentResult.aztecShieldGateway,
      };
    }

    // Save deployment data
    console.log('Saving deployment data...');
    await writeDeploymentData(
      paths.deploymentFile,
      deploymentData as DeploymentData,
    );
  } else {
    console.log('Using existing complete Turnstile contract deployments');
  }

  // Check if tokens should be deployed
  const hasTokens = Object.keys(config.deployment.tokens).length > 0;
  if (hasTokens && deploymentData.aztecPortal) {
    console.log('Processing token deployments...');

    // Initialize tokens object if it doesn't exist
    if (!deploymentData.tokens) {
      deploymentData.tokens = {};
    }

    // Process each token individually
    for (const [symbol, tokenConfig] of Object.entries(
      config.deployment.tokens,
    )) {
      // Skip already deployed tokens unless overwrite is requested
      if (
        !config.deployment.overwrite &&
        deploymentData.tokens[symbol] &&
        deploymentData.tokens[symbol].l1Address &&
        deploymentData.tokens[symbol].l2Address
      ) {
        console.log(`Token ${symbol} already deployed, skipping...`);
        continue;
      }

      console.log(`Deploying token: ${symbol}...`);
      try {
        // Deploy single token
        const result = await deployToken(
          l1Client,
          l2Client,
          deploymentData.aztecPortal as `0x${string}`,
          tokenConfig,
        );

        // Update token data in deployment data
        deploymentData.tokens[symbol] = {
          name: result.name,
          symbol: result.symbol,
          decimals: result.decimals,
          l1Address: result.l1Address,
          l2Address: result.l2Address,
        };

        // Save after each token deployment
        console.log(`Token ${symbol} deployed, saving deployment data...`);
        await writeDeploymentData(
          paths.deploymentFile,
          deploymentData as DeploymentData,
        );
      } catch (error) {
        console.error(`Failed to deploy token ${symbol}:`, error);
        // Continue with next token even if one fails
      }
    }
  }
}
