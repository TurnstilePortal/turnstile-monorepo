export const FakeAztecRegistryABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_rollup",
        "type": "address",
        "internalType": "contract IMinimalAztecRollup"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getRollup",
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
    "name": "rollup",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IMinimalAztecRollup"
      }
    ],
    "stateMutability": "view"
  }
] as const;

export const FakeAztecRegistryBytecode = '0x608060405234801561000f575f5ffd5b506040516102a53803806102a5833981810160405281019061003191906100e5565b805f5f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050610110565b5f5ffd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6100a38261007a565b9050919050565b5f6100b482610099565b9050919050565b6100c4816100aa565b81146100ce575f5ffd5b50565b5f815190506100df816100bb565b92915050565b5f602082840312156100fa576100f9610076565b5b5f610107848285016100d1565b91505092915050565b6101888061011d5f395ff3fe608060405234801561000f575f5ffd5b5060043610610034575f3560e01c8063a4d2342a14610038578063cb23bcb514610056575b5f5ffd5b610040610074565b60405161004d9190610139565b60405180910390f35b61005e61009b565b60405161006b9190610139565b60405180910390f35b5f5f5f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b5f5f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f819050919050565b5f6101016100fc6100f7846100bf565b6100de565b6100bf565b9050919050565b5f610112826100e7565b9050919050565b5f61012382610108565b9050919050565b61013381610119565b82525050565b5f60208201905061014c5f83018461012a565b9291505056fea26469706673582212203c425b2ea813fcd0eb69754c8276540abc5ac51d788be4b932d29f437a3b61c764736f6c634300081c0033';
