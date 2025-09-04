/**
 * Unified deploy command
 */

import { existsSync } from 'node:fs';
import { AztecAddress, createAztecNodeClient } from '@aztec/aztec.js';
import {
  type DeploymentData,
  getChain,
  getClients,
  writeDeploymentData,
} from '@turnstile-portal/turnstile-dev';
import type { Command } from 'commander';
import { http } from 'viem';
import {
  createDefaultConfig,
  ensureConfigDirectory,
  getConfigPaths,
  loadDeployConfig,
} from '../config/config-loader.js';
import type { DeployConfig } from '../config/types.js';
import {
  acceptL1DevToken,
  bridgeL1ToL2DevToken,
  proposeL1DevToken,
  registerL1DevToken,
  registerL2DevToken,
} from '../lib/deploy/devTokens.js';
import { deployTurnstileContracts } from '../lib/deployment.js';
import { deployToken } from '../lib/tokens.js';
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
            console.log('Deployment will fail without --overwrite flag');
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

  const deploymentExists = existsSync(paths.deploymentFile);

  // Check if deployment exists and overwrite is not enabled
  if (deploymentExists && !config.deployment.overwrite) {
    throw new Error(
      `Deployment file already exists at ${paths.deploymentFile}. Use --overwrite to redeploy.`,
    );
  }

  // Initialize clients
  const { l1Client, l2Client } = await getClients(
    config.connection.aztec,
    {
      chain: getChain(config.connection.ethereum.chainName),
      transport: http(config.connection.ethereum.rpc),
    },
    paths.keysFile,
  );

  console.log(`L1 Address: ${l1Client.getAddress()}`);
  console.log(`L2 Address: ${l2Client.getAddress()}`);

  // Initialize fresh deployment data
  let deploymentData: Partial<DeploymentData> = {};

  if (deploymentExists && config.deployment.overwrite) {
    console.log('Overwrite enabled: Starting fresh deployment');
  }

  const node = createAztecNodeClient(config.connection.aztec.node);
  const l1Addresses = await node.getL1ContractAddresses();
  const registryAddress = l1Addresses.registryAddress.toString();

  console.log('Starting deployment of all Turnstile contracts...');

  try {
    // Deploy all contracts
    const deploymentResult = await deployTurnstileContracts(
      l1Client,
      l2Client,
      { registryAddress },
    );

    // Update deployment data with all results
    deploymentData = {
      l1AllowList: deploymentResult.l1AllowList,
      l1Portal: deploymentResult.l1Portal,
      aztecTokenContractClassID: deploymentResult.aztecTokenContractClassID,
      aztecPortal: deploymentResult.aztecPortal,
      serializedAztecPortalInstance:
        deploymentResult.serializedAztecPortalInstance,
      aztecShieldGateway: deploymentResult.aztecShieldGateway,
      serializedShieldGatewayInstance:
        deploymentResult.serializedShieldGatewayInstance,
    };

    // Save deployment data
    console.log('Saving deployment data...');
    await writeDeploymentData(
      paths.deploymentFile,
      deploymentData as DeploymentData,
    );
    console.log('Turnstile contracts deployed successfully!');
  } catch (error) {
    // If deployment failed but we have partial data, save it for debugging
    if (Object.keys(deploymentData).length > 0) {
      console.log(
        'Deployment failed. Saving partial deployment data for debugging...',
      );
      await writeDeploymentData(
        paths.deploymentFile,
        deploymentData as DeploymentData,
      );
    }
    throw error;
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
        if (
          !deploymentData.l1AllowList ||
          !deploymentData.aztecPortal ||
          !deploymentData.l1Portal
        ) {
          throw new Error(
            'Missing required deployment data for token deployment',
          );
        }

        // Deploy single token
        const result = await deployToken(
          l1Client,
          l2Client,
          deploymentData.aztecPortal,
          tokenConfig,
        );

        // Propose the token
        await proposeL1DevToken(
          l1Client,
          result.l1Address,
          deploymentData.l1AllowList,
        );

        // Accept the token
        await acceptL1DevToken(
          l1Client,
          result.l1Address,
          deploymentData.l1AllowList,
        );

        // Register the token on L1 via the L2 portal
        // This initiates an L1 Portal -> L2 Portal message with the registration confirmation
        const { messageHash, messageIndex, l2BlockNumber } =
          await registerL1DevToken(
            l1Client,
            result.l1Address,
            deploymentData.l1Portal,
          );

        // Register the token with the L2 Portal
        await registerL2DevToken(
          l2Client,
          deploymentData.aztecPortal,
          result.l1Address,
          result.l2Address,
          tokenConfig.name,
          tokenConfig.symbol,
          tokenConfig.decimals,
          messageIndex,
          Number(l2BlockNumber),
          messageHash,
        );

        await bridgeL1ToL2DevToken(
          l1Client,
          l2Client,
          result.l1Address,
          AztecAddress.fromString(result.l2Address),
          deploymentData.l1Portal,
          AztecAddress.fromString(deploymentData.aztecPortal),
        );

        // Update token data in deployment data
        deploymentData.tokens[symbol] = {
          name: result.name,
          symbol: result.symbol,
          decimals: result.decimals,
          l1Address: result.l1Address,
          l2Address: result.l2Address,
          serializedL2TokenInstance: result.serializedL2TokenInstance,
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
