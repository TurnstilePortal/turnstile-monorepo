# Turnstile Deployment Configuration

The deployment module exposes utilities for loading network metadata (portal addresses, token registries, RPC URLs) from the
Turnstile deployment manifests. These helpers are intentionally minimal—they simply fetch and cache JSON, leaving it up to you to
wire the data into your own clients or workflows.

## Loading configuration

```ts
import { loadConfig } from '@turnstile-portal/turnstile.js/deployment';

const config = await loadConfig('sandbox');
console.log(config.network.deployment.l1Portal);
```

You can pass a predefined network name (`sandbox`, `testnet`, `mainnet`, `local`), a URL pointing at a deployment JSON document,
or a direct object literal matching the `TurnstileConfig` shape.

## Clearing the cache

The loader caches results per source to avoid repeated network requests. Call `clearConfigCache()` to force a refresh:

```ts
import { clearConfigCache } from '@turnstile-portal/turnstile.js/deployment';

clearConfigCache();
```

## Configuration types

The following TypeScript types are exported for convenience:

- `TurnstileConfig` – top-level configuration document
- `NetworkConfig` – per-network metadata
- `DeploymentData` / `DeploymentDataToken` – bridge contract addresses and token metadata

Use these types to ensure your application handles deployment metadata consistently across environments.
