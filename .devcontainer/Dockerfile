FROM mcr.microsoft.com/devcontainers/base:bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  python3-pip \
  python-is-python3 \
  virtualenv \
  ripgrep \
  jq \
  yq \
  yamllint \
  curl \
  chromium \
  vim

RUN update-alternatives --set editor /usr/bin/vim.basic

ENV DISABLE_TELEMETRY=1
ENV DEVCONTAINER=true
ARG USERNAME=vscode
USER vscode

