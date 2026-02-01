import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getAuctionById } from "@/lib/mock-auctions"
import { PlaceBidForm } from "./place-bid-form"
import { cn } from "@/lib/utils"
import type { AuctionStatus } from "@/lib/mock-auctions"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const auction = getAuctionById(id)
  if (!auction) return { title: "Auction — BlindPool" }
  return {
    title: `${auction.tokenSymbol} — BlindPool`,
    description: auction.description ?? `Sealed-bid CCA: ${auction.tokenName}`,
  }
}

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
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const auction = getAuctionById(id)
  if (!auction) notFound()

  const canBid = auction.status === "active" || auction.status === "upcoming"

  return (
    <div className="px-6 md:px-12 py-12 md:py-20">
      <Link
        href="/auctions"
        className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors"
      >
        ← All auctions
      </Link>

      <div className="mt-8 md:mt-12 max-w-3xl">
        <div className="flex items-center gap-3">
          <h1 className="font-[var(--font-bebas)] text-4xl md:text-6xl tracking-tight">
            {auction.tokenSymbol}
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
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {auction.tokenName} · {auction.chainName}
        </p>
        {auction.description && (
          <p className="mt-6 font-mono text-sm text-muted-foreground leading-relaxed">
            {auction.description}
          </p>
        )}

        <dl className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-sm">
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Clearing price
            </dt>
            <dd className="mt-1 text-foreground">{auction.clearingPrice} ETH</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Sealed bids
            </dt>
            <dd className="mt-1 text-foreground">{auction.bidCount}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Total commitment
            </dt>
            <dd className="mt-1 text-foreground">{auction.totalCommitment} ETH</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
              {auction.status === "ended" ? "Closed" : "Ends"}
            </dt>
            <dd className="mt-1 text-foreground">
              {auction.status === "ended"
                ? "Closed"
                : formatTime(auction.endTime)}
            </dd>
          </div>
        </dl>

        {canBid && (
          <div className="mt-14 pt-10 border-t border-border/40">
            <h2 className="font-[var(--font-bebas)] text-2xl md:text-3xl tracking-tight">
              Place sealed bid
            </h2>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              Your bid is confidential until the auction closes. No one can see your price or identity.
            </p>
            <PlaceBidForm auctionId={auction.id} tokenSymbol={auction.tokenSymbol} />
          </div>
        )}

        {auction.status === "ended" && (
          <div className="mt-14 pt-10 border-t border-border/40">
            <p className="font-mono text-sm text-muted-foreground">
              This auction has ended. Liquidity has been seeded to the Uniswap pool.
            </p>
          </div>
        )}

        <div className="mt-14 pt-10 border-t border-border/40">
          <h3 className="font-[var(--font-bebas)] text-xl tracking-tight text-muted-foreground">
            How sealed-bid CCA works
          </h3>
          <ul className="mt-4 font-mono text-xs text-muted-foreground space-y-2 max-w-xl">
            <li>· Bids are submitted privately; no one sees your price or identity until close.</li>
            <li>· Bids integrate over time to determine a fair market-clearing price.</li>
            <li>· When the auction ends, the clearing price is set and liquidity is seeded to Uniswap.</li>
            <li>· You receive tokens at the clearing price. MEV and sniping are mitigated by sealed bids.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
