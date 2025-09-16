# Repository Guidelines

## Project Structure & Module Organization
This pnpm workspace houses public SDK code in `packages/turnstile.js`, developer tooling in `packages/turnstile-dev`, and deployment helpers in `packages/deploy`. Generated contract artifacts live alongside their producers under `*-artifacts`. On-chain sources sit in `aztec/` for Noir and `l1/` for Foundry Solidity. Keep unit tests adjacent to implementations (for example, `packages/turnstile.js/src/l1/portal.test.ts`), and place shared scripts in `scripts/`. Sample configs and walkthroughs belong in `examples/`.

## Build, Test, and Development Commands
Run `pnpm install` after cloning or changing versions to hydrate the workspace. Use `pnpm build` to compile TypeScript packages; `make build` additionally refreshes contract artifacts. Execute `pnpm test` for Vitest suites, or `pnpm test -- --coverage` to emit V8 coverage into `coverage/`. `make test-l1` runs Foundry tests, while `make test-aztec` compiles Noir contracts. For full sandbox verification, launch `scripts/test-e2e.sh` (or `make test-e2e`).

## Coding Style & Naming Conventions
TypeScript targets ESM—always include `.js` in relative imports even inside `.ts` files. Default to 2-space indentation, prefer `const`, and use `camelCase` for variables/functions with `PascalCase` for exported types. Enforce formatting via `pnpm format` (Biome) and linting with `pnpm lint`; the combined `pnpm check` command must pass before review.

## Testing Guidelines
Author Vitest specs alongside source files using `describe`/`it` and keep filenames as `*.test.ts`. Mock external systems with helpers from `packages/turnstile-dev/src`. Solidity updates require Foundry tests under `l1/test/`; Noir changes should add coverage in `aztec/contracts/*/tests/`. Aim to capture new flows in both L1 and L2 paths and document any manual sandbox verification when automation falls short.

## Commit & Pull Request Guidelines
Follow Conventional Commit messages such as `feat:`, `fix:`, or `chore:` with concise imperatives. PRs should outline the problem, summarize the solution, link related issues or specs, and attach test output (Vitest, Foundry, Noir) plus screenshots for user-facing updates. Run `pnpm changeset` when shipping user-visible changes and call out regenerated artifacts that downstream consumers rely on.

## Environment & Tooling Tips
Invoke `make init` once to install dependencies and register Git hooks from `hooks/`. Adhere to the pnpm version pinned in `package.json`. When updating deployment tooling, rebuild the Docker image with `make turnstile-deploy-docker-image` to keep CI environments in sync.
