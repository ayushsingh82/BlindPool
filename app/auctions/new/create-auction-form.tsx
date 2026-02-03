"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther, encodePacked, encodeAbiParameters, parseAbiParameters, type Address } from "viem"

const CCA_FACTORY = "0xcca1101C61cF5cb44C968947985300DF945C3565" as const

// Minimal Factory ABI for initializeDistribution
const FACTORY_ABI = [
  {
    name: "initializeDistribution",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "configData", type: "bytes" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
] as const

const DURATION_OPTIONS = [
  { value: "5m", label: "5 min (testing)", blocks: 25 },
  { value: "1h", label: "1 hr", blocks: 300 },
  { value: "6h", label: "6 hr", blocks: 1800 },
  { value: "1d", label: "1 day", blocks: 7200 },
  { value: "7d", label: "7 day", blocks: 50400 },
] as const

const inputClass = cn(
  "mt-2 w-full border border-border bg-input/50 px-4 py-3 font-mono text-sm",
  "placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent",
)
const labelClass = "block font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

// Q96 = 2^96 — used for price encoding in CCA
const Q96 = BigInt(2) ** BigInt(96)

function ethToQ96(ethPrice: string): bigint {
  const price = parseFloat(ethPrice)
  if (!Number.isFinite(price) || price <= 0) return BigInt(0)
  // floorPrice in Q96: price * 2^96
  return BigInt(Math.floor(price * Number(Q96)))
}

function isValidAddress(addr: string): addr is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

export function CreateAuctionForm() {
  const router = useRouter()
  const { address, isConnected } = useAccount()

  // Offchain metadata
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  // Onchain params
  const [tokenAddress, setTokenAddress] = useState("")
  const [totalSupply, setTotalSupply] = useState("")
  const [reservePrice, setReservePrice] = useState("")
  const [duration, setDuration] = useState<string>("5m")
  const [tokensRecipient, setTokensRecipient] = useState("")
  const [fundsRecipient, setFundsRecipient] = useState("")

  const [error, setError] = useState<string | null>(null)

  const { data: txHash, writeContract, isPending: isWriting } = useWriteContract()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  const submitted = isWriting || isConfirming || isSuccess

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isConnected || !address) {
      setError("Connect your wallet first.")
      return
    }
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (!isValidAddress(tokenAddress)) {
      setError("Token address must be a valid Ethereum address.")
      return
    }
    const supply = parseFloat(totalSupply)
    if (!Number.isFinite(supply) || supply <= 0) {
      setError("Total supply must be a positive number.")
      return
    }
    const reserve = parseFloat(reservePrice)
    if (!Number.isFinite(reserve) || reserve <= 0) {
      setError("Reserve price (floor) must be a positive number.")
      return
    }
    const tokensRecip = (tokensRecipient.trim() || address) as Address
    const fundsRecip = (fundsRecipient.trim() || address) as Address
    if (!isValidAddress(tokensRecip)) {
      setError("Tokens recipient must be a valid address.")
      return
    }
    if (!isValidAddress(fundsRecip)) {
      setError("Funds recipient must be a valid address.")
      return
    }

    // Calculate block range
    const durationOpt = DURATION_OPTIONS.find((o) => o.value === duration)!
    const startBlockOffset = 5 // start ~5 blocks from now
    const endBlockOffset = startBlockOffset + durationOpt.blocks

    const floorPrice = ethToQ96(reservePrice)
    // tickSpacing: use 1% of floor price as a reasonable default
    const tickSpacing = floorPrice / BigInt(100) || BigInt(1)

    // Build AuctionParameters struct and encode as configData
    // Struct: (address currency, address tokensRecipient, address fundsRecipient,
    //          uint64 startBlock, uint64 endBlock, uint64 claimBlock,
    //          uint256 tickSpacing, address validationHook, uint256 floorPrice,
    //          uint128 requiredCurrencyRaised, bytes auctionStepsData)
    const configData = encodeAbiParameters(
      parseAbiParameters(
        "address currency, address tokensRecipient, address fundsRecipient, uint64 startBlock, uint64 endBlock, uint64 claimBlock, uint256 tickSpacing, address validationHook, uint256 floorPrice, uint128 requiredCurrencyRaised, bytes auctionStepsData"
      ),
      [
        "0x0000000000000000000000000000000000000000", // currency = ETH
        tokensRecip,
        fundsRecip,
        BigInt(startBlockOffset),  // relative — contract adds current block
        BigInt(endBlockOffset),
        BigInt(endBlockOffset),    // claimBlock = endBlock
        tickSpacing,
        "0x0000000000000000000000000000000000000000", // no validation hook
        floorPrice,
        BigInt(0),                 // no minimum raise
        "0x",                      // empty auctionStepsData
      ]
    )

    const amount = parseEther(totalSupply)

    writeContract({
      address: CCA_FACTORY,
      abi: FACTORY_ABI,
      functionName: "initializeDistribution",
      args: [
        tokenAddress as Address,
        amount,
        configData,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div
          role="alert"
          className="border border-destructive/50 bg-destructive/10 px-4 py-3 font-mono text-sm text-destructive"
        >
          {error}
        </div>
      )}
      {isSuccess && (
        <div
          role="status"
          className="border border-accent/50 bg-accent/10 px-4 py-3 font-mono text-sm text-accent"
        >
          Auction created on Sepolia! Tx: {txHash?.slice(0, 10)}…
          <br />
          <span className="text-[10px] text-muted-foreground">
            Next: mint tokens to the auction address and call onTokensReceived().
          </span>
        </div>
      )}

      {/* Offchain metadata */}
      <div>
        <label htmlFor="name" className={labelClass}>
          Name <span className="text-muted-foreground/50">(offchain)</span>
        </label>
        <input
          id="name"
          type="text"
          placeholder="e.g. My Token Launch"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          disabled={submitted}
          required
        />
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Description <span className="text-muted-foreground/50">(offchain)</span>
        </label>
        <textarea
          id="description"
          placeholder="Describe the auction and token..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={cn(inputClass, "resize-y min-h-[80px]")}
          disabled={submitted}
        />
      </div>

      {/* Onchain params */}
      <div className="border-t border-border/40 pt-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-accent mb-4">
          Onchain parameters (Sepolia)
        </p>

        <div className="space-y-5">
          <div>
            <label htmlFor="tokenAddress" className={labelClass}>
              Token address
            </label>
            <input
              id="tokenAddress"
              type="text"
              placeholder="0x..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              className={inputClass}
              disabled={submitted}
              required
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              ERC20 token you deployed on Sepolia
            </p>
          </div>

          <div>
            <label htmlFor="totalSupply" className={labelClass}>
              Total supply (tokens to sell)
            </label>
            <input
              id="totalSupply"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1000000"
              value={totalSupply}
              onChange={(e) => setTotalSupply(e.target.value)}
              className={inputClass}
              disabled={submitted}
              required
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              Amount of tokens (in token units, e.g. 18 decimals)
            </p>
          </div>

          <div>
            <label htmlFor="reservePrice" className={labelClass}>
              Floor price (ETH per token)
            </label>
            <input
              id="reservePrice"
              type="text"
              inputMode="decimal"
              placeholder="0.001"
              value={reservePrice}
              onChange={(e) => setReservePrice(e.target.value)}
              className={inputClass}
              disabled={submitted}
              required
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              Minimum price — encoded as Q96 floorPrice onchain
            </p>
          </div>

          <div>
            <label htmlFor="duration" className={labelClass}>
              Duration
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className={cn(
                inputClass,
                "cursor-pointer appearance-none bg-input/50 pr-10",
                "bg-[length:12px] bg-[right_12px_center] bg-no-repeat",
              )}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%23555' stroke-width='1.5' stroke-linecap='round'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E")`,
              }}
              disabled={submitted}
            >
              {DURATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} (~{opt.blocks} blocks)
                </option>
              ))}
            </select>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              Converted to startBlock / endBlock (~12s per Sepolia block)
            </p>
          </div>

          <div>
            <label htmlFor="tokensRecipient" className={labelClass}>
              Tokens recipient <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <input
              id="tokensRecipient"
              type="text"
              placeholder={address || "0x... (defaults to your wallet)"}
              value={tokensRecipient}
              onChange={(e) => setTokensRecipient(e.target.value)}
              className={inputClass}
              disabled={submitted}
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              Receives leftover tokens. Defaults to connected wallet.
            </p>
          </div>

          <div>
            <label htmlFor="fundsRecipient" className={labelClass}>
              Funds recipient <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <input
              id="fundsRecipient"
              type="text"
              placeholder={address || "0x... (defaults to your wallet)"}
              value={fundsRecipient}
              onChange={(e) => setFundsRecipient(e.target.value)}
              className={inputClass}
              disabled={submitted}
            />
            <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
              Receives raised ETH. Defaults to connected wallet.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 pt-4">
        <button
          type="submit"
          disabled={submitted || !name.trim() || !isConnected}
          aria-busy={isWriting || isConfirming}
          className={cn(
            "border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest",
            "hover:border-accent hover:text-accent transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
          )}
        >
          {isWriting
            ? "Confirm in wallet…"
            : isConfirming
              ? "Confirming…"
              : isSuccess
                ? "Created"
                : "Create auction"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/auctions")}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="mt-8 font-mono text-[10px] text-muted-foreground/70 border border-border/40 px-3 py-2 space-y-1">
        <p>
          <strong>Factory:</strong>{" "}
          <code className="text-accent/80">{CCA_FACTORY}</code> (Sepolia)
        </p>
        <p>
          Calls <code>initializeDistribution(token, amount, configData, salt)</code> on the CCA Factory.
          After creation, mint tokens to the auction address and call <code>onTokensReceived()</code>.
        </p>
      </div>
    </form>
  )
}
