import { formatUnits, getContract, Client, parseAbi } from 'viem';
import type {
  Account,
  Address,
  Chain,
  GetContractReturnType,
  Transport,
  WalletClient,
  PublicClient,
} from 'viem';

const ERC20ABI = parseAbi([
  'function name() public view returns(string)',
  'function symbol() public view returns(string)',
  'function decimals() public view returns(uint8)',
  'function totalSupply() public view returns(uint256)',
  'function balanceOf(address _owner) public view returns(uint256 balance)',
  'function transfer(address _to, uint256 _value) public returns(bool success)',
  'function transferFrom(address _from, address _to, uint256 _value) public returns(bool success)',
  'function approve(address _spender, uint256 _value) public returns(bool success)',
  'function allowance(address _owner, address _spender) public view returns(uint256 remaining)',
  'event Transfer(address indexed from, address indexed to, uint256 amount)',
]);

/**
 * ERC20 contract interface
 */
export type ERC20 = GetContractReturnType<typeof ERC20ABI, Client, Address>;

/**
 * Get the ERC20 contract instance
 * @param tokenAddr ERC20 contract address
 * @param client Client instance
 * @returns ERC20 contract instance
 */
export function getERC20Contract(
  tokenAddr: Address,
  client: Client | { public: PublicClient; wallet: WalletClient },
): ERC20 {
  return getContract({
    address: tokenAddr,
    abi: ERC20ABI,
    client,
  });
}

/**
 * L1 Token class
 */
export class L1Token {
  wc: WalletClient<Transport, Chain, Account>;
  pc: PublicClient;

  /**
   * Constructor
   * @param wc Wallet client instance
   * @param pc Public client instance
   */
  constructor(wc: WalletClient<Transport, Chain, Account>, pc: PublicClient) {
    this.wc = wc;
    this.pc = pc;
  }

  /**
   * Get the ERC20 contract instance
   * @param tokenAddr ERC20 contract address
   * @returns ERC20 contract instance
   */
  async tokenContract(tokenAddr: Address): Promise<ERC20> {
    return getERC20Contract(tokenAddr, { public: this.pc, wallet: this.wc });
  }

  /**
   * Approve a spender to spend a certain amount of tokens
   * @param tokenAddr ERC20 contract address
   * @param spender Spender address
   * @param amount Amount to approve
   */
  async approve(tokenAddr: Address, spender: Address, amount: bigint) {
    const token = await this.tokenContract(tokenAddr);
    const symbol = await token.read.symbol();
    const amountFmt = formatUnits(amount, await token.read.decimals());

    console.debug(
      `Approving ${spender} to spend ${amount} (${amountFmt}) of ${tokenAddr} (${symbol})`,
    );
    const hash = await token.write.approve([spender, amount], {
      account: this.wc.account,
      chain: this.wc.chain,
    });
    console.debug(`approve(${spender}, ${amount}) tx hash:`, hash);
    const receipt = await this.pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') {
      throw new Error(`approve() failed: ${receipt}`);
    }
  }

  async balanceOf(tokenAddr: Address, owner: Address): Promise<bigint> {
    const token = await this.tokenContract(tokenAddr);
    return token.read.balanceOf([owner]);
  }
}
