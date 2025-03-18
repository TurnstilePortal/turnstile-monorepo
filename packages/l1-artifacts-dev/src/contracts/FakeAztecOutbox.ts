export const FakeAztecOutboxABI = [
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

export const FakeAztecOutboxBytecode = '0x6080604052348015600e575f5ffd5b506101c98061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610029575f3560e01c80637fb349671461002d575b5f5ffd5b6100476004803603810190610042919061010e565b610049565b005b5050505050565b5f5ffd5b5f5ffd5b5f5ffd5b5f60a0828403121561007157610070610058565b5b81905092915050565b5f819050919050565b61008c8161007a565b8114610096575f5ffd5b50565b5f813590506100a781610083565b92915050565b5f5ffd5b5f5ffd5b5f5ffd5b5f5f83601f8401126100ce576100cd6100ad565b5b8235905067ffffffffffffffff8111156100eb576100ea6100b1565b5b602083019150836020820283011115610107576101066100b5565b5b9250929050565b5f5f5f5f5f610100868803121561012857610127610050565b5b5f6101358882890161005c565b95505060a061014688828901610099565b94505060c061015788828901610099565b93505060e086013567ffffffffffffffff81111561017857610177610054565b5b610184888289016100b9565b9250925050929550929590935056fea264697066735822122057e8057199d550f3184fdf4b4e84668d01765f8754ff345e5cc44565b2edd8eb64736f6c634300081c0033';
