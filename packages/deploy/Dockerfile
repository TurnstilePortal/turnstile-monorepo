FROM node:20-alpine

# Set metadata and use ARG for dynamic version
ARG VERSION=0.0.0
LABEL maintainer="Turnstile Portal Team"
LABEL description="Turnstile Deployment CLI Tool"
LABEL version="${VERSION}"

ENV NODE_NO_WARNINGS=1

# Install pnpm
RUN npm install -g pnpm

# Create app directory and set permissions
WORKDIR /app

# Copy only the necessary files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages

# Install all dependencies and build all packages
RUN pnpm install && \
  pnpm -r build

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
