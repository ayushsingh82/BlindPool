import { type Address } from "viem"

export const CCA_FACTORY = "0xcca1101C61cF5cb44C968947985300DF945C3565" as const

// Block just before the first auction was created (tx 0x620fb366... was in block 10184145)
export const FACTORY_DEPLOY_BLOCK = BigInt(10_184_000)

export const Q96 = BigInt(2) ** BigInt(96)

/** Convert Q96-encoded price to a human-readable ETH string */
export function q96ToEth(q96Price: bigint): string {
  if (q96Price === BigInt(0)) return "0"
  // price = q96Price / 2^96, show up to 8 decimals
  const whole = q96Price / Q96
  const remainder = q96Price % Q96
  const decimals = (remainder * BigInt(100_000_000)) / Q96
  const dec = decimals.toString().padStart(8, "0").replace(/0+$/, "")
  if (!dec) return whole.toString()
  return `${whole}.${dec}`
}

export type AuctionStatus = "upcoming" | "active" | "ended"

export interface OnchainAuction {
  /** Auction contract address (used as ID) */
  address: Address
  token: Address
  startBlock: bigint
  endBlock: bigint
  clearingPrice: string
  clearingPriceRaw: bigint
  floorPrice: string
  bidCount: number
  currencyRaised: string
  totalSupply: string
  status: AuctionStatus
}

// Factory ABI — only the event we need
export const FACTORY_ABI = [
  {
    type: "event",
    name: "AuctionCreated",
    inputs: [
      { name: "auction", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "configData", type: "bytes", indexed: false },
    ],
  },
] as const

// Auction contract ABI — view functions we need
export const AUCTION_ABI = [
  { type: "function", name: "token", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "startBlock", inputs: [], outputs: [{ type: "uint64" }], stateMutability: "view" },
  { type: "function", name: "endBlock", inputs: [], outputs: [{ type: "uint64" }], stateMutability: "view" },
  { type: "function", name: "clearingPrice", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "floorPrice", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "nextBidId", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "currencyRaised", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ type: "uint128" }], stateMutability: "view" },
] as const
