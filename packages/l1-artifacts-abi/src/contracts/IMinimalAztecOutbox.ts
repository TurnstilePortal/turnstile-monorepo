export const IMinimalAztecOutboxABI = [
  {
    "type": "function",
    "name": "consume",
    "inputs": [
      {
        "name": "_message",
        "type": "tuple",
        "internalType": "struct DataStructures.L2ToL1Msg",
        "components": [
          {
            "name": "sender",
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
            "name": "recipient",
            "type": "tuple",
            "internalType": "struct DataStructures.L1Actor",
            "components": [
              {
                "name": "actor",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "chainId",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "content",
            "type": "bytes32",
            "internalType": "bytes32"
          }
        ]
      },
      {
        "name": "_l2BlockNumber",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_leafIndex",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_path",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;
