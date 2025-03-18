export const IMinimalAztecRollupABI = [
  {
    "type": "function",
    "name": "getInbox",
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
    "name": "getOutbox",
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
