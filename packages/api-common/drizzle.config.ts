/// <reference types="node" />
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./src/schema/tokens.ts', './src/schema/block-progress.ts', './src/schema/contracts.ts'],
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: nothing will work without this
    url: process.env.DATABASE_URL!,
  },
});
