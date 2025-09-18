FROM node:trixie-slim AS builder

WORKDIR /repo

# packages needed for node-gyp dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  python3-pip \
  python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --frozen-lockfile --filter @turnstile-portal/deploy...
RUN pnpm --filter @turnstile-portal/deploy... build

# Set the working directory to the deploy package
WORKDIR /app/packages/deploy

# Make CLI executable
RUN chmod +x ./dist/cli.js

# Use a non-root user for better security
RUN addgroup -S turnstile && adduser -S turnstile -G turnstile
RUN chown -R turnstile:turnstile /app
USER turnstile

# Set the entry point to run the CLI
ENTRYPOINT ["./dist/cli.js"]
# Default command if none provided
CMD ["--help"]
