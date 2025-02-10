import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { task } from 'hardhat/config';
import { join } from 'path';
import { lstatSync, readdirSync, readFileSync } from 'fs';

task('broadcastAddresses', 'Broadcast addresses')
  .addPositionalParam('chainId', 'Chain ID')
  .setAction(broadcastAddressesTask);

function getFiles(dir: string): string[] {
  const files: string[] = [];
  readdirSync(dir).forEach((file) => {
    const fullPath = join(dir, file);
    if (lstatSync(fullPath).isDirectory()) {
      files.push(...getFiles(fullPath));
    } else {
      files.push(join(dir, file));
    }
  });
  return files;
}

async function broadcastAddressesTask(
  args: any,
): Promise<Record<string, Record<string, string>>> {
  const files = getFiles('./broadcast').filter(
    (fn) => fn.includes(`${args.chainId}`) && fn.endsWith('run-latest.json'),
  );

  const deployments: Record<string, Record<string, string>> = {};

  for (const f of files) {
    const data = readFileSync(f, 'utf8');
    const json = JSON.parse(data);
    const script = f.split('/')[1];
    const contracts = getAddresses(json.transactions);
    if (Object.keys(contracts).length > 0) {
      deployments[script] = contracts;
    }
  }

  for (const [_, contracts] of Object.entries(deployments)) {
    for (const [contract, address] of Object.entries(contracts)) {
      console.log(`${contract}: ${address}`);
    }
  }
  return deployments;
}

function getAddresses(transactions: any): Record<string, string> {
  const contracts: Record<string, string> = {};
  for (const tx of transactions.sort(
    (a: any, b: any) =>
      Number(a.transaction.nonce) - Number(b.transaction.nonce),
  )) {
    if (tx.transactionType == 'CREATE2') {
      if (tx.contractName == 'InsecureMintableToken') {
        let symbol = tx.arguments[1];
        contracts[symbol] = tx.contractAddress;
      } else {
        contracts[tx.contractName] = tx.contractAddress;
      }
    }
  }
  return contracts;
}
