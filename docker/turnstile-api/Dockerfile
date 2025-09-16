FROM node:trixie-slim AS builder
ARG SERVICE
RUN test -n "$SERVICE" || (echo "❌ ERROR: --build-arg SERVICE=<package name> is required" && exit 1)
WORKDIR /repo
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages ./packages

RUN pnpm install --filter ${SERVICE}... --frozen-lockfile
RUN pnpm --filter ${SERVICE}... build
RUN pnpm deploy --filter ${SERVICE} --prod /out

FROM node:trixie-slim AS runtime

WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
COPY --from=builder /out/ .

# Drop root privileges
USER node
CMD ["pnpm","start"]
