"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { parseEther, type Address } from "viem"
import { AUCTION_ABI, ethToQ96 } from "@/lib/auction-contracts"

const inputClass = cn(
  "mt-2 w-full border border-border bg-input/50 px-4 py-3 font-mono text-sm",
  "placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent",
)
const labelClass = "block font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

export function PlaceBidForm({
  auctionId,
  tokenSymbol,
  floorPrice,
}: {
  auctionId: string
  tokenSymbol: string
  floorPrice?: string
}) {
  const { address, isConnected } = useAccount()
  const [amount, setAmount] = useState("")
  const [maxPrice, setMaxPrice] = useState("")
  const [error, setError] = useState<string | null>(null)

  const { data: txHash, writeContract, isPending: isWriting, reset: resetWrite, error: writeError } = useWriteContract()

  const { isLoading: isConfirming, isSuccess, error: receiptError } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Surface contract/tx errors to the user
  const hookError = writeError || receiptError

  const submitted = isWriting || (isConfirming && !hookError)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (hookError) resetWrite()

    if (!isConnected || !address) {
      setError("Connect your wallet first.")
      return
    }

    const amountNum = parseFloat(amount)
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Amount must be a positive number.")
      return
    }

    const maxPriceNum = parseFloat(maxPrice)
    if (!Number.isFinite(maxPriceNum) || maxPriceNum <= 0) {
      setError("Max price must be a positive number.")
      return
    }

    const amountWei = parseEther(amount)
    const maxPriceQ96 = ethToQ96(maxPrice)

    if (maxPriceQ96 === BigInt(0)) {
      setError("Max price is too small to encode.")
      return
    }

    console.log("submitBid params:", {
      auction: auctionId,
      maxPrice: maxPriceQ96.toString(),
      amount: amountWei.toString(),
      owner: address,
    })

    writeContract({
      address: auctionId as Address,
      abi: AUCTION_ABI,
      functionName: "submitBid",
      args: [
        maxPriceQ96,
        amountWei,
        address,
        "0x" as `0x${string}`,
      ],
      value: amountWei,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-sm space-y-5">
      {(error || hookError) && (
        <div
          role="alert"
          className="border border-destructive/50 bg-destructive/10 px-4 py-3 font-mono text-sm text-destructive break-all"
        >
          {error || hookError?.message || "Transaction failed."}
          {hookError && "shortMessage" in hookError && hookError.shortMessage && (
            <p className="mt-1 text-[10px] text-destructive/70">{String(hookError.shortMessage)}</p>
          )}
        </div>
      )}
      {isSuccess && (
        <div
          role="status"
          className="border border-accent/50 bg-accent/10 px-4 py-3 font-mono text-sm text-accent"
        >
          Bid placed successfully! Tx: {txHash?.slice(0, 10)}...
          <br />
          <span className="text-[10px] text-muted-foreground">
            Your bid is now onchain. You will receive {tokenSymbol} at the clearing price when the auction ends.
          </span>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => {
                resetWrite()
                setAmount("")
                setMaxPrice("")
              }}
              className="border border-accent/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest hover:bg-accent/20 transition-colors"
            >
              Place another bid
            </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="maxPrice" className={labelClass}>
          Max price (ETH per token)
        </label>
        <input
          id="maxPrice"
          type="text"
          inputMode="decimal"
          placeholder={floorPrice ? `e.g. ${floorPrice} or higher` : "0.001"}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className={inputClass}
          disabled={submitted}
          required
        />
        <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
          Maximum price you are willing to pay per token (encoded as Q96 onchain).
          {floorPrice && <> Floor: {floorPrice} ETH.</>}
        </p>
      </div>

      <div>
        <label htmlFor="amount" className={labelClass}>
          Amount (ETH)
        </label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
          disabled={submitted}
          required
        />
        <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
          ETH to commit. Sent as msg.value with the bid.
        </p>
      </div>

      <button
        type="submit"
        disabled={submitted || !amount || !maxPrice || !isConnected}
        aria-busy={isWriting || isConfirming}
        className={cn(
          "mt-4 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest",
          "hover:border-accent hover:text-accent transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        {isWriting
          ? "Confirm in wallet..."
          : isConfirming && !hookError
            ? "Confirming..."
            : isSuccess
              ? "Bid placed"
              : hookError
                ? "Try again"
                : "Submit bid"}
      </button>

      <div className="mt-4 font-mono text-[10px] text-muted-foreground/70 border border-border/40 px-3 py-2 space-y-1">
        <p>
          Calls <code>submitBid(maxPrice, amount, owner, hookData)</code> on the auction contract
          with <code>msg.value = amount</code>.
        </p>
        <p>
          Auction: <code className="text-accent/80 break-all">{auctionId}</code>
        </p>
      </div>
    </form>
  )
}
