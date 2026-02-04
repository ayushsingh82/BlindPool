"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { usePublicClient, useBlockNumber } from "wagmi"
import { sepolia } from "wagmi/chains"
import { formatEther, type Address } from "viem"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { PlaceBidForm } from "./place-bid-form"
import { cn } from "@/lib/utils"
import {
  AUCTION_ABI,
  q96ToEth,
  type AuctionStatus,
} from "@/lib/auction-contracts"

function statusLabel(s: AuctionStatus) {
  switch (s) {
    case "active": return "Active"
    case "upcoming": return "Upcoming"
    case "ended": return "Ended"
  }
}

function blocksToTime(blocks: bigint): string {
  const seconds = Number(blocks) * 12
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

interface AuctionData {
  address: Address
  token: Address
  startBlock: bigint
  endBlock: bigint
  clearingPrice: string
  clearingPriceRaw: bigint
  floorPrice: string
  floorPriceRaw: bigint
  bidCount: number
  currencyRaised: string
  totalSupply: string
  tickSpacing: bigint
}

export default function AuctionDetailPage() {
  const params = useParams()
  const auctionAddress = params.id as Address
  const publicClient = usePublicClient({ chainId: sepolia.id })

  // Watch block ONLY for countdown display — NOT used in any useEffect deps
  const { data: currentBlock } = useBlockNumber({ chainId: sepolia.id, watch: true })

  const [auction, setAuction] = useState<AuctionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const fetchedRef = useRef(false)

  const fetchAuction = useCallback(async () => {
    if (!publicClient) return
    try {
      const results = await publicClient.multicall({
        contracts: [
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "token" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "startBlock" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "endBlock" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "clearingPrice" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "floorPrice" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "nextBidId" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "currencyRaised" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "totalSupply" },
          { address: auctionAddress, abi: AUCTION_ABI, functionName: "tickSpacing" },
        ],
      })

      setAuction({
        address: auctionAddress,
        token: results[0].result as Address,
        startBlock: (results[1].result as bigint) ?? BigInt(0),
        endBlock: (results[2].result as bigint) ?? BigInt(0),
        clearingPrice: q96ToEth((results[3].result as bigint) ?? BigInt(0)),
        clearingPriceRaw: (results[3].result as bigint) ?? BigInt(0),
        floorPrice: q96ToEth((results[4].result as bigint) ?? BigInt(0)),
        floorPriceRaw: (results[4].result as bigint) ?? BigInt(0),
        bidCount: Number((results[5].result as bigint) ?? BigInt(0)),
        currencyRaised: formatEther((results[6].result as bigint) ?? BigInt(0)),
        totalSupply: formatEther((results[7].result as bigint) ?? BigInt(0)),
        tickSpacing: (results[8].result as bigint) ?? BigInt(0),
      })
      setFetchError(null)
    } catch (err: unknown) {
      // Only set error if we have no data yet
      if (!auction) setFetchError(err instanceof Error ? err.message : "Failed to fetch auction")
    } finally {
      setLoading(false)
    }
  }, [publicClient, auctionAddress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial fetch — runs once when publicClient is ready
  useEffect(() => {
    if (!publicClient || fetchedRef.current) return
    fetchedRef.current = true
    fetchAuction()
  }, [publicClient, fetchAuction])

  // Derive status from block number — never downgrade if currentBlock is temporarily undefined
  const prevStatusRef = useRef<AuctionStatus>("upcoming")
  const status: AuctionStatus = useMemo(() => {
    if (!auction) return prevStatusRef.current
    if (!currentBlock) return prevStatusRef.current // keep previous, don't unmount form
    let s: AuctionStatus = "upcoming"
    if (currentBlock >= auction.endBlock) s = "ended"
    else if (currentBlock >= auction.startBlock) s = "active"
    prevStatusRef.current = s
    return s
  }, [auction, currentBlock])

  // Always show bid form if status is or was active — never unmount mid-interaction
  const canBid = status === "active"

  if (loading) {
    return (
      <div className="px-6 md:px-12 py-12 md:py-20">
        <p className="font-mono text-sm text-muted-foreground animate-pulse">
          Loading auction from Sepolia...
        </p>
      </div>
    )
  }

  if (fetchError || !auction) {
    return (
      <div className="px-6 md:px-12 py-12 md:py-20">
        <Link href="/auctions" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">
          &larr; All auctions
        </Link>
        <div className="mt-8 border border-destructive/50 bg-destructive/10 p-6">
          <p className="font-mono text-sm text-destructive">{fetchError ?? "Auction not found."}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 md:px-12 py-12 md:py-20">
      <Link href="/auctions" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">
        &larr; All auctions
      </Link>

      <div className="mt-8 md:mt-12 max-w-3xl">
        <div className="flex items-center gap-3">
          <h1 className="font-[var(--font-bebas)] text-4xl md:text-6xl tracking-tight">CCA</h1>
          <span className={cn(
            "font-mono text-[10px] uppercase tracking-widest px-2 py-1 border",
            status === "active" && "border-accent/60 text-accent",
            status !== "active" && "border-muted-foreground/40 text-muted-foreground",
          )}>
            {statusLabel(status)}
          </span>
        </div>
        <p className="mt-2 font-mono text-xs text-muted-foreground break-all">{auction.address}</p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">Token: {auction.token} · Sepolia</p>

        <dl className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Clearing price</dt>
            <dd className="mt-1 text-foreground">{auction.clearingPrice} ETH</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Floor price</dt>
            <dd className="mt-1 text-foreground">{auction.floorPrice} ETH</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Bids</dt>
            <dd className="mt-1 text-foreground">{auction.bidCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Raised</dt>
            <dd className="mt-1 text-foreground">{parseFloat(auction.currencyRaised).toFixed(4)} ETH</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Total supply</dt>
            <dd className="mt-1 text-foreground">{parseFloat(auction.totalSupply).toLocaleString()} tokens</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Blocks</dt>
            <dd className="mt-1 text-foreground text-[10px]">{auction.startBlock.toString()} → {auction.endBlock.toString()}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{status === "ended" ? "Ended" : "Ends in"}</dt>
            <dd className="mt-1 text-foreground">
              {status === "ended"
                ? "Closed"
                : currentBlock
                  ? `~${blocksToTime(auction.endBlock - currentBlock)}`
                  : "—"}
            </dd>
          </div>
        </dl>

        {canBid && (
          <div className="mt-14 pt-10 border-t border-border/40">
            <h2 className="font-[var(--font-bebas)] text-2xl md:text-3xl tracking-tight">Place sealed bid</h2>
            <p className="mt-2 font-mono text-xs text-muted-foreground">Your bid is confidential until the auction closes.</p>
            <PlaceBidForm
              auctionId={auction.address}
              tokenSymbol="CCA"
              floorPrice={auction.floorPrice}
              floorPriceRaw={auction.floorPriceRaw}
              clearingPrice={auction.clearingPrice}
              clearingPriceRaw={auction.clearingPriceRaw}
              totalSupply={auction.totalSupply}
              tickSpacing={auction.tickSpacing}
            />
          </div>
        )}

        {status === "upcoming" && (
          <div className="mt-14 pt-10 border-t border-border/40">
            <p className="font-mono text-sm text-muted-foreground">
              Auction has not started yet. Bidding opens at block {auction.startBlock.toString()}.
              {currentBlock && <> Current block: {currentBlock.toString()}.</>}
            </p>
          </div>
        )}

        {status === "ended" && (
          <div className="mt-14 pt-10 border-t border-border/40">
            <p className="font-mono text-sm text-muted-foreground">This auction has ended. Final clearing price: {auction.clearingPrice} ETH.</p>
          </div>
        )}
      </div>
    </div>
  )
}
