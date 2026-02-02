import Link from "next/link"
import { Suspense } from "react"
import { mockAuctions, getAuctionsByStatus } from "@/lib/mock-auctions"
import { AuctionStatusTabs } from "@/components/auction-status-tabs"
import { cn } from "@/lib/utils"
import type { AuctionStatus } from "@/lib/mock-auctions"

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

function formatTime(ms: number) {
  const d = new Date(ms)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const filter = status === "active" || status === "upcoming" || status === "ended" ? status : undefined
  const auctions = filter ? getAuctionsByStatus(filter) : mockAuctions

  return (
    <div className="px-6 md:px-12 py-12 md:py-20">
      <div className="mb-10">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">
          Auctions
        </span>
        <h1 className="mt-4 font-[var(--font-bebas)] text-5xl md:text-7xl tracking-tight">
          SEALED-BID CCA
        </h1>
        <p className="mt-6 max-w-lg font-mono text-sm text-muted-foreground leading-relaxed">
          Privacy-first Continuous Clearing Auctions. Bids stay confidential until the auction closes. No MEV sniping, fair price discovery.
        </p>
      </div>

      <div className="mb-10 flex items-center justify-between gap-4 flex-wrap">
        <Suspense fallback={<div className="h-9 w-48 bg-muted/30 animate-pulse" />}>
          <AuctionStatusTabs />
        </Suspense>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {auctions.length} auction{auctions.length !== 1 ? "s" : ""}
          </span>
          <Link
            href="/auctions/new"
            className={cn(
              "border border-foreground/20 px-4 py-2 font-mono text-xs uppercase tracking-widest",
              "hover:border-accent hover:text-accent transition-all duration-200",
            )}
          >
            Create auction
          </Link>
        </div>
      </div>

      {auctions.length === 0 ? (
        <div className="border border-border/40 p-12 md:p-16 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            {filter
              ? `No ${statusLabel(filter as AuctionStatus).toLowerCase()} auctions right now.`
              : "No auctions right now."}
          </p>
          <Link href="/auctions" className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-accent hover:underline">
            View all
          </Link>
        </div>
      ) : (
      <ul className="grid gap-4 md:gap-6">
        {auctions.map((auction) => (
          <li key={auction.id}>
            <Link
              href={`/auctions/${auction.id}`}
              className={cn(
                "block border border-border/40 p-6 md:p-8 transition-all duration-200",
                "hover:border-accent/60 hover:bg-accent/5",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-[var(--font-bebas)] text-2xl md:text-4xl tracking-tight">
                      {auction.tokenSymbol}
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
                  <p className="mt-2 font-mono text-sm text-muted-foreground">
                    {auction.tokenName} · {auction.chainName}
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
                      Sealed bids
                    </span>
                    <span className="text-foreground">{auction.bidCount}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-muted-foreground/70">
                      Ends
                    </span>
                    <span className="text-foreground">
                      {auction.status === "ended"
                        ? "Closed"
                        : formatTime(auction.endTime)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      )}
    </div>
  )
}
