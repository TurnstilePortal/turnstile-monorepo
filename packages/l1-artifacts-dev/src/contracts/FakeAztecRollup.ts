export const FakeAztecRollupABI = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_inbox",
        "type": "address",
        "internalType": "contract IMinimalAztecInbox"
      },
      {
        "name": "_outbox",
        "type": "address",
        "internalType": "contract IMinimalAztecOutbox"
      }
    ],
    "stateMutability": "nonpayable"
  },
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
  },
  {
    "type": "function",
    "name": "inbox",
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
    "name": "outbox",
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

export const FakeAztecRollupBytecode = '0x608060405234801561000f575f5ffd5b5060405161040c38038061040c83398181016040528101906100319190610161565b815f5f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508060015f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550505061019f565b5f5ffd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6100e4826100bb565b9050919050565b5f6100f5826100da565b9050919050565b610105816100eb565b811461010f575f5ffd5b50565b5f81519050610120816100fc565b92915050565b5f610130826100da565b9050919050565b61014081610126565b811461014a575f5ffd5b50565b5f8151905061015b81610137565b92915050565b5f5f60408385031215610177576101766100b7565b5b5f61018485828601610112565b92505060206101958582860161014d565b9150509250929050565b610260806101ac5f395ff3fe608060405234801561000f575f5ffd5b506004361061004a575f3560e01c8063368c093c1461004e578063a32fbb7b1461006c578063ce11e6ab1461008a578063fb0e722b146100a8575b5f5ffd5b6100566100c6565b60405161006391906101d8565b60405180910390f35b6100746100ed565b6040516100819190610211565b60405180910390f35b610092610115565b60405161009f9190610211565b60405180910390f35b6100b061013a565b6040516100bd91906101d8565b60405180910390f35b5f5f5f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b5f60015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b5f5f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f819050919050565b5f6101a061019b6101968461015e565b61017d565b61015e565b9050919050565b5f6101b182610186565b9050919050565b5f6101c2826101a7565b9050919050565b6101d2816101b8565b82525050565b5f6020820190506101eb5f8301846101c9565b92915050565b5f6101fb826101a7565b9050919050565b61020b816101f1565b82525050565b5f6020820190506102245f830184610202565b9291505056fea264697066735822122034038cd998df6ce792ce7dc9d0f1140dea6ce488e159abed46aaf341f52bdf5764736f6c634300081c0033';
