import { Option } from 'commander';

export const commonOpts = {
  keys: new Option(
    '-k, --keys <keyfile.json>',
    'Key file',
  ).makeOptionMandatory(),
  pxe: new Option('-p, --pxe <url>', 'PXE server URL').default(
    'http://localhost:8080',
  ),
  rpc: new Option('--rpc <url>', 'RPC server URL').default(
    'http://localhost:8545',
  ),
  l1Chain: new Option('--l1-chain <chain>', 'L1 Chain').default('anvil'),
  deploymentData: new Option(
    '-d, --deployment-data <file>',
    'Deployment Data File',
  ).default('sandbox_deployment.json'),
};
