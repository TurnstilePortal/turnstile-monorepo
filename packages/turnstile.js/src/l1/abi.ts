/**
 * ABIs for ERC20 token functions
 */
export const TOKEN_ABIS = {
  /** ABI for the symbol function */
  symbol: [
    {
      name: 'symbol',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'string' }]
    }
  ] as const,

  /** ABI for the name function */
  name: [
    {
      name: 'name',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'string' }]
    }
  ] as const,

  /** ABI for the decimals function */
  decimals: [
    {
      name: 'decimals',
      type: 'function',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'uint8' }]
    }
  ] as const,

  /** ABI for the balanceOf function */
  balanceOf: [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'owner', type: 'address' }],
      outputs: [{ type: 'uint256' }]
    }
  ] as const,

  /** ABI for the allowance function */
  allowance: [
    {
      name: 'allowance',
      type: 'function',
      stateMutability: 'view',
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' }
      ],
      outputs: [{ type: 'uint256' }]
    }
  ] as const,

  /** ABI for the approve function */
  approve: [
    {
      name: 'approve',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ type: 'bool' }]
    }
  ] as const,

  /** ABI for the transfer function */
  transfer: [
    {
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ type: 'bool' }]
    }
  ] as const,
};

/**
 * Complete ERC20 token ABI for common operations
 */
export const ERC20_ABI = [
  ...TOKEN_ABIS.symbol,
  ...TOKEN_ABIS.name,
  ...TOKEN_ABIS.decimals,
  ...TOKEN_ABIS.balanceOf,
  ...TOKEN_ABIS.allowance,
  ...TOKEN_ABIS.approve,
  ...TOKEN_ABIS.transfer,
] as const;
