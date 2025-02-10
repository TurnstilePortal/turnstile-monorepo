export const IMinimalAztecRollupABI = [
  {
    "type": "function",
    "name": "INBOX",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMinimalAztecInbox"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "OUTBOX",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMinimalAztecOutbox"
      }
    ],
    "stateMutability": "view"
  }
] as const;
