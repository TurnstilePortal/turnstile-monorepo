FROM node:20

ARG PACKAGE_VERSION
RUN test -n "$PACKAGE_VERSION" || (echo "PACKAGE_VERSION build-arg is required" && false)

WORKDIR /turnstile

COPY /deploy-sandbox.sh /turnstile/
COPY /sandbox-keys.json /turnstile/
COPY /base-sandbox-deployment.json /turnstile/sandbox-data.json

RUN npm install -g @turnstile-portal/deploy@${PACKAGE_VERSION}

ENTRYPOINT ["/bin/bash", "/turnstile/deploy-sandbox.sh"]
