"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { usePublicClient, useBlockNumber } from "wagmi"
import { sepolia } from "wagmi/chains"
import { formatEther, type Address } from "viem"
import { useEffect, useState } from "react"
import { PlaceBidForm } from "./place-bid-form"
import { cn } from "@/lib/utils"
import {
  AUCTION_ABI,
  q96ToEth,
  type AuctionStatus,
} from "@/lib/auction-contracts"

function statusLabel(s: AuctionStatus) {
  switch (s) {
    case "active":
      return "Active"
    case "upcoming":
      return "Upcoming"
    case "ended":
      return "Ended"
  }
}

function blocksToTime(blocks: bigint): string {
  const seconds = Number(blocks) * 12
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

interface AuctionDetail {
  address: Address
  token: Address
  startBlock: bigint
  endBlock: bigint
  clearingPrice: string
  floorPrice: string
  bidCount: number
  currencyRaised: string
  totalSupply: string
  status: AuctionStatus
}

export default function AuctionDetailPage() {
  const params = useParams()
  const auctionAddress = params.id as Address
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const { data: currentBlock } = useBlockNumber({ chainId: sepolia.id, watch: true })
  const [auction, setAuction] = useState<AuctionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicClient || !currentBlock || !auctionAddress) return
    let cancelled = false

    async function fetch() {
      try {
        setLoading(true)
        const results = await publicClient!.multicall({
          contracts: [
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "token" },
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "startBlock" },
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "endBlock" },
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "clearingPrice" },
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "floorPrice" },
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "nextBidId" },
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "currencyRaised" },
            { address: auctionAddress, abi: AUCTION_ABI, functionName: "totalSupply" },
          ],
        })

        if (cancelled) return

        const token = results[0].result as Address
        const startBlock = (results[1].result as bigint) ?? BigInt(0)
        const endBlock = (results[2].result as bigint) ?? BigInt(0)
        const clearingPriceRaw = (results[3].result as bigint) ?? BigInt(0)
        const floorPriceRaw = (results[4].result as bigint) ?? BigInt(0)
        const nextBidId = (results[5].result as bigint) ?? BigInt(0)
        const currencyRaisedRaw = (results[6].result as bigint) ?? BigInt(0)
        const totalSupplyRaw = (results[7].result as bigint) ?? BigInt(0)

        let status: AuctionStatus = "upcoming"
        if (currentBlock! >= endBlock) status = "ended"
        else if (currentBlock! >= startBlock) status = "active"

        setAuction({
          address: auctionAddress,
          token,
          startBlock,
          endBlock,
          clearingPrice: q96ToEth(clearingPriceRaw),
          floorPrice: q96ToEth(floorPriceRaw),
          bidCount: Number(nextBidId),
          currencyRaised: formatEther(currencyRaisedRaw),
          totalSupply: formatEther(totalSupplyRaw),
          status,
        })
        setError(null)
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Failed to fetch auction")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetch()
    return () => { cancelled = true }
  }, [publicClient, currentBlock, auctionAddress])

  if (loading) {
    return (
      <div className="px-6 md:px-12 py-12 md:py-20">
        <p className="font-mono text-sm text-muted-foreground animate-pulse">
          Loading auction from Sepolia...
        </p>
      </div>
    )
  }

  if (error || !auction) {
    return (
      <div className="px-6 md:px-12 py-12 md:py-20">
        <Link
          href="/auctions"
          className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
        >
          &larr; All auctions
        </Link>
        <div className="mt-8 border border-destructive/50 bg-destructive/10 p-6">
          <p className="font-mono text-sm text-destructive">
            {error ?? "Auction not found."}
          </p>
        </div>
      </div>
    )
  }

  const canBid = auction.status === "active"

  return (
    <div className="px-6 md:px-12 py-12 md:py-20">
      <Link
        href="/auctions"
        className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
      >
        &larr; All auctions
      </Link>

      <div className="mt-8 md:mt-12 max-w-3xl">
        <div className="flex items-center gap-3">
          <h1 className="font-[var(--font-bebas)] text-4xl md:text-6xl tracking-tight">
            CCA
          </h1>
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-widest px-2 py-1 border",
              auction.status === "active" && "border-accent/60 text-accent",
              auction.status === "upcoming" && "border-muted-foreground/40 text-muted-foreground",
              auction.status === "ended" && "border-muted-foreground/40 text-muted-foreground",
            )}
          >
            {statusLabel(auction.status)}
          </span>
        </div>
        <p className="mt-2 font-mono text-xs text-muted-foreground break-all">
          {auction.address}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
          Token: {auction.token} · Sepolia
        </p>

        <dl className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Clearing price
            </dt>
            <dd className="mt-1 text-foreground">{auction.clearingPrice} ETH</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Floor price
            </dt>
            <dd className="mt-1 text-foreground">{auction.floorPrice} ETH</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Bids
            </dt>
            <dd className="mt-1 text-foreground">{auction.bidCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Raised
            </dt>
            <dd className="mt-1 text-foreground">
              {parseFloat(auction.currencyRaised).toFixed(4)} ETH
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Total supply
            </dt>
            <dd className="mt-1 text-foreground">
              {parseFloat(auction.totalSupply).toLocaleString()} tokens
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Blocks
            </dt>
            <dd className="mt-1 text-foreground text-[10px]">
              {auction.startBlock.toString()} → {auction.endBlock.toString()}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              {auction.status === "ended" ? "Ended" : "Ends in"}
            </dt>
            <dd className="mt-1 text-foreground">
              {auction.status === "ended"
                ? "Closed"
                : currentBlock
                  ? `~${blocksToTime(auction.endBlock - currentBlock)}`
                  : "—"}
            </dd>
          </div>
        </dl>

        {canBid && (
          <div className="mt-14 pt-10 border-t border-border/40">
            <h2 className="font-[var(--font-bebas)] text-2xl md:text-3xl tracking-tight">
              Place sealed bid
            </h2>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Your bid is confidential until the auction closes.
            </p>
            <PlaceBidForm auctionId={auction.address} tokenSymbol="CCA" />
          </div>
        )}

        {auction.status === "ended" && (
          <div className="mt-14 pt-10 border-t border-border/40">
            <p className="font-mono text-sm text-muted-foreground">
              This auction has ended. Final clearing price: {auction.clearingPrice} ETH.
            </p>
          </div>
        )}

        <div className="mt-14 pt-10 border-t border-border/40">
          <h3 className="font-[var(--font-bebas)] text-xl tracking-tight text-muted-foreground">
            How sealed-bid CCA works
          </h3>
          <ul className="mt-4 font-mono text-xs text-muted-foreground space-y-2 max-w-xl">
            <li>· Bids are submitted privately; no one sees your price until close.</li>
            <li>· Bids integrate over time to determine a fair market-clearing price.</li>
            <li>· When the auction ends, the clearing price is set.</li>
            <li>· You receive tokens at the clearing price. MEV and sniping are mitigated.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
