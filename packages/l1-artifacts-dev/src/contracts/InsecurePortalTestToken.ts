export const InsecurePortalTestTokenABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "_decimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowance",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "approve",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balanceOf",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "decimals",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "mint",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "name",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "symbol",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalSupply",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferFrom",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Approval",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "spender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      {
        "name": "from",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "to",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC20InsufficientAllowance",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "allowance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InsufficientBalance",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "balance",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "needed",
        "type": "uint256",
        "internalType": "uint256"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidApprover",
    "inputs": [
      {
        "name": "approver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidReceiver",
    "inputs": [
      {
        "name": "receiver",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSender",
    "inputs": [
      {
        "name": "sender",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "ERC20InvalidSpender",
    "inputs": [
      {
        "name": "spender",
        "type": "address",
        "internalType": "address"
      }
    ]
  }
] as const;

export const InsecurePortalTestTokenBytecode = '0x608060405234801561000f575f5ffd5b506040518060400160405280601981526020017f496e736563757265506f7274616c205465737420546f6b656e000000000000008152506040518060400160405280600481526020017f495054540000000000000000000000000000000000000000000000000000000081525060128282816003908161008f9190610301565b50806004908161009f9190610301565b5050508060055f6101000a81548160ff021916908360ff1602179055505050506103d0565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f600282049050600182168061013f57607f821691505b602082108103610152576101516100fb565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f600883026101b47fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610179565b6101be8683610179565b95508019841693508086168417925050509392505050565b5f819050919050565b5f819050919050565b5f6102026101fd6101f8846101d6565b6101df565b6101d6565b9050919050565b5f819050919050565b61021b836101e8565b61022f61022782610209565b848454610185565b825550505050565b5f5f905090565b610246610237565b610251818484610212565b505050565b5b81811015610274576102695f8261023e565b600181019050610257565b5050565b601f8211156102b95761028a81610158565b6102938461016a565b810160208510156102a2578190505b6102b66102ae8561016a565b830182610256565b50505b505050565b5f82821c905092915050565b5f6102d95f19846008026102be565b1980831691505092915050565b5f6102f183836102ca565b9150826002028217905092915050565b61030a826100c4565b67ffffffffffffffff811115610323576103226100ce565b5b61032d8254610128565b610338828285610278565b5f60209050601f831160018114610369575f8415610357578287015190505b61036185826102e6565b8655506103c8565b601f19841661037786610158565b5f5b8281101561039e57848901518255600182019150602085019450602081019050610379565b868310156103bb57848901516103b7601f8916826102ca565b8355505b6001600288020188555050505b505050505050565b610ede806103dd5f395ff3fe608060405234801561000f575f5ffd5b50600436106100a7575f3560e01c806332424aa31161006f57806332424aa31461016557806340c10f191461018357806370a082311461019f57806395d89b41146101cf578063a9059cbb146101ed578063dd62ed3e1461021d576100a7565b806306fdde03146100ab578063095ea7b3146100c957806318160ddd146100f957806323b872dd14610117578063313ce56714610147575b5f5ffd5b6100b361024d565b6040516100c09190610b57565b60405180910390f35b6100e360048036038101906100de9190610c08565b6102dd565b6040516100f09190610c60565b60405180910390f35b6101016102ff565b60405161010e9190610c88565b60405180910390f35b610131600480360381019061012c9190610ca1565b610308565b60405161013e9190610c60565b60405180910390f35b61014f610336565b60405161015c9190610d0c565b60405180910390f35b61016d61034b565b60405161017a9190610d0c565b60405180910390f35b61019d60048036038101906101989190610c08565b61035d565b005b6101b960048036038101906101b49190610d25565b61036b565b6040516101c69190610c88565b60405180910390f35b6101d76103b0565b6040516101e49190610b57565b60405180910390f35b61020760048036038101906102029190610c08565b610440565b6040516102149190610c60565b60405180910390f35b61023760048036038101906102329190610d50565b610462565b6040516102449190610c88565b60405180910390f35b60606003805461025c90610dbb565b80601f016020809104026020016040519081016040528092919081815260200182805461028890610dbb565b80156102d35780601f106102aa576101008083540402835291602001916102d3565b820191905f5260205f20905b8154815290600101906020018083116102b657829003601f168201915b5050505050905090565b5f5f6102e76104e4565b90506102f48185856104eb565b600191505092915050565b5f600254905090565b5f5f6103126104e4565b905061031f8582856104fd565b61032a858585610590565b60019150509392505050565b5f60055f9054906101000a900460ff16905090565b60055f9054906101000a900460ff1681565b6103678282610680565b5050565b5f5f5f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050919050565b6060600480546103bf90610dbb565b80601f01602080910402602001604051908101604052809291908181526020018280546103eb90610dbb565b80156104365780601f1061040d57610100808354040283529160200191610436565b820191905f5260205f20905b81548152906001019060200180831161041957829003601f168201915b5050505050905090565b5f5f61044a6104e4565b9050610457818585610590565b600191505092915050565b5f60015f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2054905092915050565b5f33905090565b6104f883838360016106ff565b505050565b5f6105088484610462565b90507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81101561058a578181101561057b578281836040517ffb8f41b200000000000000000000000000000000000000000000000000000000815260040161057293929190610dfa565b60405180910390fd5b61058984848484035f6106ff565b5b50505050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff1603610600575f6040517f96c6fd1e0000000000000000000000000000000000000000000000000000000081526004016105f79190610e2f565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610670575f6040517fec442f050000000000000000000000000000000000000000000000000000000081526004016106679190610e2f565b60405180910390fd5b61067b8383836108ce565b505050565b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036106f0575f6040517fec442f050000000000000000000000000000000000000000000000000000000081526004016106e79190610e2f565b60405180910390fd5b6106fb5f83836108ce565b5050565b5f73ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff160361076f575f6040517fe602df050000000000000000000000000000000000000000000000000000000081526004016107669190610e2f565b60405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036107df575f6040517f94280d620000000000000000000000000000000000000000000000000000000081526004016107d69190610e2f565b60405180910390fd5b8160015f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f208190555080156108c8578273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516108bf9190610c88565b60405180910390a35b50505050565b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff160361091e578060025f8282546109129190610e75565b925050819055506109ec565b5f5f5f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20549050818110156109a7578381836040517fe450d38c00000000000000000000000000000000000000000000000000000000815260040161099e93929190610dfa565b60405180910390fd5b8181035f5f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f2081905550505b5f73ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff1603610a33578060025f8282540392505081905550610a7d565b805f5f8473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055505b8173ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051610ada9190610c88565b60405180910390a3505050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f610b2982610ae7565b610b338185610af1565b9350610b43818560208601610b01565b610b4c81610b0f565b840191505092915050565b5f6020820190508181035f830152610b6f8184610b1f565b905092915050565b5f5ffd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f610ba482610b7b565b9050919050565b610bb481610b9a565b8114610bbe575f5ffd5b50565b5f81359050610bcf81610bab565b92915050565b5f819050919050565b610be781610bd5565b8114610bf1575f5ffd5b50565b5f81359050610c0281610bde565b92915050565b5f5f60408385031215610c1e57610c1d610b77565b5b5f610c2b85828601610bc1565b9250506020610c3c85828601610bf4565b9150509250929050565b5f8115159050919050565b610c5a81610c46565b82525050565b5f602082019050610c735f830184610c51565b92915050565b610c8281610bd5565b82525050565b5f602082019050610c9b5f830184610c79565b92915050565b5f5f5f60608486031215610cb857610cb7610b77565b5b5f610cc586828701610bc1565b9350506020610cd686828701610bc1565b9250506040610ce786828701610bf4565b9150509250925092565b5f60ff82169050919050565b610d0681610cf1565b82525050565b5f602082019050610d1f5f830184610cfd565b92915050565b5f60208284031215610d3a57610d39610b77565b5b5f610d4784828501610bc1565b91505092915050565b5f5f60408385031215610d6657610d65610b77565b5b5f610d7385828601610bc1565b9250506020610d8485828601610bc1565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f6002820490506001821680610dd257607f821691505b602082108103610de557610de4610d8e565b5b50919050565b610df481610b9a565b82525050565b5f606082019050610e0d5f830186610deb565b610e1a6020830185610c79565b610e276040830184610c79565b949350505050565b5f602082019050610e425f830184610deb565b92915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610e7f82610bd5565b9150610e8a83610bd5565b9250828201905080821115610ea257610ea1610e48565b5b9291505056fea26469706673582212205642c3c9fbf1ecf054357fe807639e6c6d21ec37dd6f71c7c21644ef26b5ad3e64736f6c634300081c0033';
