# Turnstile REPL

## Installation

```bash
npm install @turnstile-portal/repl
```


## Usage

Prerequisites:

- A running [Turnstile Sandbox](https://github.com/TurnstilePortal/turnstile-monorepo/tree/main/docker/turnstile-sandbox) environment
- Deployment data JSON file from the Turnstile Sandbox
- Key data JSON file from the Turnstile Sandbox


```bash
npx turnstile-repl --deploymentData /path/to/deploymentData.json --keyData /path/to/keyData.json
```

## Commands

- `.help` - Show help
- `.dd` - Show the deployment data
- `.kd` - Show the key data
- `.turnstile` - Show the Turnstile REPL default imports
- `.exit` - Exit the REPL
