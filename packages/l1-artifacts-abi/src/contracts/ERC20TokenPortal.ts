export const ERC20TokenPortalABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_aztecRegistry",
        "type": "address",
        "internalType": "contract IMinimalAztecRegistry"
      },
      {
        "name": "_allowList",
        "type": "address",
        "internalType": "contract IAllowList"
      },
      {
        "name": "_l2PortalInitializer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ALLOW_LIST",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAllowList"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "AZTEC_REGISTRY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMinimalAztecRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DEPOSIT_LIMIT",
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
    "name": "DEPOSIT_SELECTOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "L2_PORTAL_INITIALIZER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "PUBLIC_NOT_SECRET_HASH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "REGISTER_SIGNATURE",
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
    "name": "WITHDRAW_SELECTOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowList",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IAllowList"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "aztecInbox",
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
    "name": "aztecOutbox",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMinimalAztecOutbox"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "aztecRegistry",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMinimalAztecRegistry"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "aztecRollup",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMinimalAztecRollup"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "_data",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "leaf",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "l2Portal",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "propose",
    "inputs": [
      {
        "name": "_token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "register",
    "inputs": [
      {
        "name": "_token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "leaf",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "registered",
    "inputs": [
      {
        "name": "_token",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setL2Portal",
    "inputs": [
      {
        "name": "_l2Portal",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "tokenRegistry",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "withdraw",
    "inputs": [
      {
        "name": "_data",
        "type": "bytes",
        "internalType": "bytes"
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
  },
  {
    "type": "event",
    "name": "Deposit",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "leaf",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "index",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Registered",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "leaf",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "index",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SetAllowList",
    "inputs": [
      {
        "name": "allowList",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SetAztecRegistry",
    "inputs": [
      {
        "name": "registry",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SetL2Portal",
    "inputs": [
      {
        "name": "l2Portal",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ERC20TokenPortal__DepositLimitExceeded",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC20TokenPortal__InvalidData",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC20TokenPortal__InvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC20TokenPortal__InvalidTransactionType",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC20TokenPortal__NameTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ERC20TokenPortal__SymbolTooLong",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "TokenPortal__AlreadyRegistered",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "TokenPortal__AlreadySet",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TokenPortal__NoL2Portal",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TokenPortal__NotPermitted",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "TokenPortal__NotRegistered",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "TokenPortal__Unauthorized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "TokenPortal__ZeroAddress",
    "inputs": []
  }
] as const;
