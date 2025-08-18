import { Option } from 'commander';

export const commonOpts = {
  keys: new Option(
    '-k, --keys <keyfile.json>',
    'Key file',
  ).makeOptionMandatory(),
  aztecNode: new Option('-n, --aztec-node <url> ', 'Aztec Node URL').default(
    'https://sandbox.aztec.walletmesh.com/api/v1/public',
  ),
  rpc: new Option('--rpc <url>', 'RPC server URL').default(
    'https://sandbox.ethereum.walletmesh.com/api/v1/public',
  ),
  l1Chain: new Option('--l1-chain <chain>', 'L1 Chain').default('anvil'),
  deploymentData: new Option(
    '-d, --deployment-data <config>',
    'Deployment Data predefined config or config file',
  ).default('sandbox'),
};
