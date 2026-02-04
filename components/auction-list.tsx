"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePublicClient, useBlockNumber } from "wagmi"
import { sepolia } from "wagmi/chains"
import { formatEther, type Address } from "viem"
import { cn } from "@/lib/utils"
import {
  CCA_FACTORY,
  FACTORY_DEPLOY_BLOCK,
  FACTORY_ABI,
  AUCTION_ABI,
  q96ToEth,
  type OnchainAuction,
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

export function AuctionList({ filter }: { filter?: AuctionStatus }) {
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const { data: currentBlock } = useBlockNumber({ chainId: sepolia.id, watch: true })
  const [auctions, setAuctions] = useState<OnchainAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicClient || !currentBlock) return

    let cancelled = false

    async function fetchAuctions() {
      try {
        setLoading(true)

        // 1. Fetch AuctionCreated events from factory (paginate in 1000-block chunks)
        const CHUNK = BigInt(1000)
        const allLogs: { auction: Address; token: Address }[] = []
        let from = FACTORY_DEPLOY_BLOCK
        const client = publicClient!
        while (from <= currentBlock!) {
          const to = from + CHUNK - BigInt(1) > currentBlock! ? currentBlock! : from + CHUNK - BigInt(1)
          const chunk = await client.getLogs({
            address: CCA_FACTORY,
            event: FACTORY_ABI[0],
            fromBlock: from,
            toBlock: to,
          })
          for (const log of chunk) {
            if (log.args.auction && log.args.token) {
              allLogs.push({ auction: log.args.auction, token: log.args.token })
            }
          }
          from = to + BigInt(1)
        }

        if (cancelled) return

        // 2. For each auction, read its onchain state
        const auctionPromises = allLogs.map(async (log) => {
          const auctionAddr = log.auction
          const tokenAddr = log.token

          const results = await publicClient!.multicall({
            contracts: [
              { address: auctionAddr, abi: AUCTION_ABI, functionName: "startBlock" },
              { address: auctionAddr, abi: AUCTION_ABI, functionName: "endBlock" },
              { address: auctionAddr, abi: AUCTION_ABI, functionName: "clearingPrice" },
              { address: auctionAddr, abi: AUCTION_ABI, functionName: "floorPrice" },
              { address: auctionAddr, abi: AUCTION_ABI, functionName: "nextBidId" },
              { address: auctionAddr, abi: AUCTION_ABI, functionName: "currencyRaised" },
              { address: auctionAddr, abi: AUCTION_ABI, functionName: "totalSupply" },
            ],
          })

          const startBlock = (results[0].result as bigint) ?? BigInt(0)
          const endBlock = (results[1].result as bigint) ?? BigInt(0)
          const clearingPriceRaw = (results[2].result as bigint) ?? BigInt(0)
          const floorPriceRaw = (results[3].result as bigint) ?? BigInt(0)
          const nextBidId = (results[4].result as bigint) ?? BigInt(0)
          const currencyRaisedRaw = (results[5].result as bigint) ?? BigInt(0)
          const totalSupplyRaw = (results[6].result as bigint) ?? BigInt(0)

          let status: AuctionStatus = "upcoming"
          if (currentBlock! >= endBlock) {
            status = "ended"
          } else if (currentBlock! >= startBlock) {
            status = "active"
          }

          return {
            address: auctionAddr,
            token: tokenAddr,
            startBlock,
            endBlock,
            clearingPrice: q96ToEth(clearingPriceRaw),
            clearingPriceRaw,
            floorPrice: q96ToEth(floorPriceRaw),
            bidCount: Number(nextBidId),
            currencyRaised: formatEther(currencyRaisedRaw),
            totalSupply: formatEther(totalSupplyRaw),
            status,
          } satisfies OnchainAuction
        })

        const all = await Promise.all(auctionPromises)
        if (cancelled) return

        setAuctions(all)
        setError(null)
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Failed to fetch auctions")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAuctions()
    return () => { cancelled = true }
  }, [publicClient, currentBlock])

  const filtered = filter ? auctions.filter((a) => a.status === filter) : auctions

  if (loading) {
    return (
      <div className="border border-border/40 p-12 text-center">
        <p className="font-mono text-sm text-muted-foreground animate-pulse">
          Loading auctions from Sepolia...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border border-destructive/50 bg-destructive/10 p-6">
        <p className="font-mono text-sm text-destructive">{error}</p>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="border border-border/40 p-12 md:p-16 text-center">
        <p className="font-mono text-sm text-muted-foreground">
          {filter
            ? `No ${statusLabel(filter).toLowerCase()} auctions right now.`
            : "No auctions found on Sepolia."}
        </p>
        {filter && (
          <Link
            href="/auctions"
            className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-accent hover:underline"
          >
            View all
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      <span className="mb-4 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {filtered.length} auction{filtered.length !== 1 ? "s" : ""} on Sepolia
      </span>
      <ul className="grid gap-4 md:gap-6">
        {filtered.map((auction) => (
          <li key={auction.address}>
            <Link
              href={`/auctions/${auction.address}`}
              className={cn(
                "block border border-border/40 p-6 md:p-8 transition-all duration-200",
                "hover:border-accent/60 hover:bg-accent/5",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-[var(--font-bebas)] text-2xl md:text-4xl tracking-tight">
                      CCA
                    </span>
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
                    Token: {auction.token.slice(0, 6)}…{auction.token.slice(-4)} · Sepolia
                  </p>
                </div>
                <div className="flex flex-wrap gap-6 md:gap-10 font-mono text-xs text-muted-foreground">
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      Clearing price
                    </span>
                    <span className="text-foreground">
                      {auction.clearingPrice} ETH
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      Bids
                    </span>
                    <span className="text-foreground">{auction.bidCount}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      {auction.status === "ended" ? "Ended" : "Ends in"}
                    </span>
                    <span className="text-foreground">
                      {auction.status === "ended"
                        ? "Closed"
                        : currentBlock
                          ? `~${blocksToTime(auction.endBlock - currentBlock)}`
                          : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      Raised
                    </span>
                    <span className="text-foreground">
                      {parseFloat(auction.currencyRaised).toFixed(4)} ETH
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
