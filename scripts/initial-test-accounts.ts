import { getInitialTestAccounts } from '@aztec/accounts/testing';

getInitialTestAccounts()
  .then((accounts) => {
    console.log('Initial test accounts:');
    accounts.forEach((account, index) => {
      console.log(`Account ${index + 1}:`);
      console.log(`  Address: ${account.address.toString()}`);
      console.log(`  Secret key: ${account.secret.toString()}`);
      console.log(`  Signing key: ${account.signingKey.toString()}`);
      console.log(`  Salt: ${account.salt.toString()}`);
    });
  })
  .catch((error) => {
    console.error('Error fetching initial test accounts:', error);
  })
  .finally(() => {
    process.exit(0);
  });
