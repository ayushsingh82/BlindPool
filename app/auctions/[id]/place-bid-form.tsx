"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export function PlaceBidForm({
  auctionId,
  tokenSymbol,
}: {
  auctionId: string
  tokenSymbol: string
}) {
  const [amount, setAmount] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    setSubmitted(true)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 max-w-sm">
      <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Amount (ETH)
      </label>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className={cn(
          "mt-2 w-full border border-border bg-input/50 px-4 py-3 font-mono text-sm",
          "placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent",
        )}
        disabled={submitted}
      />
      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
        You will receive {tokenSymbol} at the clearing price when the auction ends. Bid is sealed.
      </p>
      <p className="mt-4 font-mono text-[10px] text-muted-foreground/70 border border-border/40 px-3 py-2">
        Demo: no wallet required. In production you would connect a wallet and sign a sealed commitment onchain.
      </p>
      <button
        type="submit"
        disabled={submitted || !amount || Number(amount) <= 0}
        className={cn(
          "mt-6 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest",
          "hover:border-accent hover:text-accent transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
        )}
      >
        {submitted ? "Bid submitted (demo)" : "Submit sealed bid"}
      </button>
    </form>
  )
}
