import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
    },
  },
  resolve: {
    alias: {
      '@turnstile-portal/api-client': resolve(root, 'packages/api-client/src/index.ts'),
      '@turnstile-portal/l1-artifacts-abi': resolve(root, 'packages/l1-artifacts-abi/src/index.ts'),
    },
  },
});
