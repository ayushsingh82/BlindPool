"use client"

import { useEffect, useState } from "react"
import { usePublicClient } from "wagmi"
import { sepolia } from "wagmi/chains"
import { formatEther, type Address } from "viem"
import { BID_SUBMITTED_EVENT, q96ToEth } from "@/lib/auction-contracts"

export interface BidRow {
  id: bigint
  owner: Address
  price: bigint
  amount: bigint
  blockNumber: bigint
}

function formatTimeAgo(blocksAgo: number): string {
  const seconds = blocksAgo * 12
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  return `${Math.round(seconds / 86400)}d ago`
}

function shortAddress(addr: Address): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const SEPOLIA_ETHERSCAN = "https://sepolia.etherscan.io"

export function LatestBids({
  auctionAddress,
  startBlock,
  currentBlock,
}: {
  auctionAddress: Address
  startBlock: bigint
  currentBlock: bigint | undefined
}) {
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const [bids, setBids] = useState<BidRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicClient) return
    let cancelled = false

    async function fetchBids() {
      try {
        setLoading(true)
        setError(null)
        const logs = await publicClient!.getLogs({
          address: auctionAddress,
          event: BID_SUBMITTED_EVENT,
          fromBlock: startBlock,
          toBlock: "latest",
        })
        if (cancelled) return
        const rows: BidRow[] = logs.map((log) => ({
          id: (log.args as { id: bigint }).id,
          owner: (log.args as { owner: Address }).owner,
          price: (log.args as { price: bigint }).price,
          amount: (log.args as { amount: bigint }).amount,
          blockNumber: log.blockNumber ?? BigInt(0),
        }))
        rows.sort((a, b) => Number(b.blockNumber - a.blockNumber))
        setBids(rows.slice(0, 5))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load bids")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBids()
    return () => { cancelled = true }
  }, [publicClient, auctionAddress, startBlock])

  if (loading) {
    return (
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground animate-pulse">
        Loading latest bids…
      </div>
    )
  }

  if (error) {
    return (
      <p className="font-mono text-xs text-destructive/80">
        {error}
      </p>
    )
  }

  if (bids.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        No bids yet. Be the first to place a bid.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full font-mono text-xs border border-border/40">
        <thead>
          <tr className="border-b border-border/40 text-[10px] uppercase tracking-widest text-muted-foreground text-left">
            <th className="py-2 px-3">Wallet</th>
            <th className="py-2 px-3">Amount (ETH)</th>
            <th className="py-2 px-3">Max price (ETH)</th>
            <th className="py-2 px-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {bids.map((bid) => (
            <tr key={`${bid.blockNumber}-${bid.id}`} className="border-b border-border/30 hover:bg-muted/20">
              <td className="py-2 px-3">
                <a
                  href={`${SEPOLIA_ETHERSCAN}/address/${bid.owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline break-all"
                >
                  {shortAddress(bid.owner)}
                </a>
              </td>
              <td className="py-2 px-3 text-foreground">
                {parseFloat(formatEther(bid.amount)).toFixed(6)}
              </td>
              <td className="py-2 px-3 text-foreground">
                {q96ToEth(bid.price)}
              </td>
              <td className="py-2 px-3 text-muted-foreground">
                {currentBlock
                  ? formatTimeAgo(Number(currentBlock - bid.blockNumber))
                  : `Block ${bid.blockNumber.toString()}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
        Latest 5 bids ·{" "}
        <a
          href={`${SEPOLIA_ETHERSCAN}/address/${auctionAddress}#events`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent/80 hover:underline"
        >
          View all on Etherscan
        </a>
      </p>
    </div>
  )
}
