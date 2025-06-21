FROM node:22-bookworm as gyp-builder
# This stage is used to build native modules that require node-gyp

ARG PACKAGE_VERSION
RUN test -n "$PACKAGE_VERSION" || (echo "PACKAGE_VERSION build-arg is required" && false)

WORKDIR /turnstile
RUN npm install @turnstile-portal/deploy@${PACKAGE_VERSION}


FROM node:22-bookworm-slim
# This is the final image that will run the Turnstile Sandbox
ARG PACKAGE_VERSION
RUN test -n "$PACKAGE_VERSION" || (echo "PACKAGE_VERSION build-arg is required" && false)

RUN apt-get update && apt-get install -y \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

COPY --from=gyp-builder /turnstile /turnstile
COPY . /turnstile

WORKDIR /turnstile

RUN npm install serve

# After deploying the Turnstile contracts, this container will serve the deployment artifacts on port 3000
EXPOSE 3000

ENTRYPOINT ["/bin/bash", "/turnstile/entrypoint.sh"]
