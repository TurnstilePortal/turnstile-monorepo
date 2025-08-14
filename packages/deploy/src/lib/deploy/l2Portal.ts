import type { Fr } from '@aztec/aztec.js';
import { getContractClassFromArtifact } from '@aztec/aztec.js';
import { TokenContractArtifact } from '@turnstile-portal/aztec-artifacts';
import type { L2Client } from '@turnstile-portal/turnstile.js';

export async function registerTurnstileTokenContractClass(
  l2Client: L2Client,
): Promise<Fr> {
  console.log('Registering Turnstile Token contract class...');
  await l2Client.getWallet().registerContractClass(TokenContractArtifact);
  const tokenContractClass = await getContractClassFromArtifact(
    TokenContractArtifact,
  );
  console.log(`Registered contract class ${tokenContractClass.id.toString()}`);
  return tokenContractClass.id;
}
