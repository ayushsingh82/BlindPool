import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Auctions — BlindPool",
  description: "Sealed-bid Continuous Clearing Auctions. Privacy-first token launches.",
}

export default function AuctionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <header className="relative z-20 border-b border-border/30 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 md:px-12 py-4">
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-accent transition-colors"
          >
            ← BlindPool
          </Link>
          <Link
            href="/auctions"
            className="font-[var(--font-bebas)] text-xl tracking-tight text-foreground"
          >
            AUCTIONS
          </Link>
        </div>
      </header>
      <div className="relative z-10">{children}</div>
    </main>
  )
}
