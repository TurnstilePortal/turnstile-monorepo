# Repository Guidelines

## Project Structure & Module Organization
This pnpm workspace keeps TypeScript packages under `packages/`. `packages/turnstile.js` is the public SDK, `packages/turnstile-dev` and `packages/deploy` host developer utilities, and the `*-artifacts` packages surface generated ABIs and bytecode. On-chain sources live in `aztec/` (Noir contracts) and `l1/` (Foundry Solidity). Shared scripts sit in `scripts/`, while sample configs land in `examples/`. Unit tests accompany source files (for example, `packages/turnstile.js/src/l1/portal.test.ts`).

## Build, Test, and Development Commands
- `pnpm install` installs workspace dependencies; run after cloning or `changeset version`.
- `pnpm build` compiles all packages; `make build` also refreshes contract artifacts.
- `pnpm test` runs Vitest across packages. Use `pnpm test -- --coverage` to generate V8 coverage in `coverage/`.
- `make test-l1` executes Foundry tests in `l1/`; `make test-aztec` compiles and checks Noir contracts.
- `pnpm lint` (`pnpm lint:fix`) and `pnpm format` (`pnpm format:fix`) enforce Biome linting and formatting.
- `scripts/test-e2e.sh` (via `make test-e2e`) spins up the sandbox integration flow.

## Coding Style & Naming Conventions
TypeScript modules target ESM, so keep relative imports suffixed with `.js` even inside `.ts` sources. Prefer 2-space indentation, `const` bindings, and `camelCase` function and variable names; use `PascalCase` for classes and exported types. Run `pnpm check` before opening a PR—this Biome command applies style and lint checks together. Solidity and Noir follow the defaults in `l1/foundry.toml` and `aztec/Makefile`; lean on the respective `make fmt` targets to stay consistent.

## Testing Guidelines
Write unit tests alongside implementations as `*.test.ts` using Vitest (`describe`/`it`). Mock external services with the shared helpers in `packages/turnstile-dev/src`. For contract changes, add Foundry tests under `l1/test/` and Noir tests under `aztec/contracts/*/tests/`. Ensure new features exercise both L1 and L2 flows before requesting review; document manual checks or sandbox runs in the PR if test automation does not cover them.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit style (`feat:`, `fix:`, `chore:`) with concise, imperative subjects. Group related changes into a single commit when practical, then open a PR with:
- A clear problem statement and summary of the solution.
- Links to related issues or specs.
- Test evidence (Vitest output, `make test-l1`, manual scenarios) and screenshots for user-facing updates.
Update `CHANGELOG.md` via `pnpm changeset` when shipping user-visible changes, and mention artifact rebuilds when they impact downstream consumers.

## Environment & Tooling Tips
Run `make init` to install dependencies and register repo-specific Git hooks from `hooks/`. Stick to the pinned pnpm version in `package.json` for reproducible builds. Docker-based deployment helpers live in `packages/deploy/Dockerfile`; rebuild the image with `make turnstile-deploy-docker-image` when bumping that package.
