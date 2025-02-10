import { createPXEClient } from '@aztec/aztec.js';
import { deployInitialTestAccounts } from '@aztec/accounts/testing';

const { PXE_URL = 'http://localhost:8080' } = process.env;
const pxe = createPXEClient(PXE_URL);
await deployInitialTestAccounts(pxe);
