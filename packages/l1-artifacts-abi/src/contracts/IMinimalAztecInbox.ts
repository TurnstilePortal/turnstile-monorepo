export const IMinimalAztecInboxABI = [
  {
    "type": "function",
    "name": "sendL2Message",
    "inputs": [
      {
        "name": "_recipient",
        "type": "tuple",
        "internalType": "struct DataStructures.L2Actor",
        "components": [
          {
            "name": "actor",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "version",
            "type": "uint256",
            "internalType": "uint256"
          }
        ]
      },
      {
        "name": "_content",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "_secretHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  }
] as const;
