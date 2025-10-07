FROM node:trixie-slim AS builder
ARG SERVICE
RUN test -n "$SERVICE" || (echo "❌ ERROR: --build-arg SERVICE=<package name> is required" && exit 1)
WORKDIR /repo

# packages needed for building node-gyp dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  python3-pip \
  python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --filter ${SERVICE}... --frozen-lockfile
RUN pnpm --filter ${SERVICE}... build
RUN pnpm deploy --legacy --filter ${SERVICE} --prod /out

FROM node:trixie-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=builder /out/ .

# Drop root privileges
USER node
CMD ["pnpm","start"]
