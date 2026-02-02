"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

const DURATION_OPTIONS = [
  { value: "5m", label: "5 min (testing)" },
  { value: "1h", label: "1 hr" },
  { value: "6h", label: "6 hr" },
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 day" },
] as const

const inputClass = cn(
  "mt-2 w-full border border-border bg-input/50 px-4 py-3 font-mono text-sm",
  "placeholder:text-muted-foreground/50 focus:outline-none focus:border-accent",
)
const labelClass = "block font-mono text-[10px] uppercase tracking-widest text-muted-foreground"

function parseReservePrice(value: string): number | null {
  const n = Number(value.trim())
  return value.trim() === "" ? null : (Number.isFinite(n) && n >= 0 ? n : null)
}

export function CreateAuctionForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [reservePrice, setReservePrice] = useState("")
  const [duration, setDuration] = useState<string>("5m")
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    const reserve = parseReservePrice(reservePrice)
    if (reserve !== null && (reserve < 0 || !Number.isFinite(reserve))) {
      setError("Reserve price must be a valid non-negative number.")
      return
    }
    setSubmitted(true)
    setSuccess(true)
    // Demo: redirect to auctions list after a short delay
    setTimeout(() => router.push("/auctions"), 2000)
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
      {success && (
        <div
          role="status"
          className="border border-accent/50 bg-accent/10 px-4 py-3 font-mono text-sm text-accent"
        >
          Auction created (demo). Redirecting to auctions…
        </div>
      )}
      <div>
        <label htmlFor="name" className={labelClass}>
          Name
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
          Description
        </label>
        <textarea
          id="description"
          placeholder="Describe the auction and token..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={cn(inputClass, "resize-y min-h-[100px]")}
          disabled={submitted}
        />
      </div>

      <div>
        <label htmlFor="reservePrice" className={labelClass}>
          Reserve price (ETH)
        </label>
        <input
          id="reservePrice"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={reservePrice}
          onChange={(e) => setReservePrice(e.target.value)}
          className={inputClass}
          disabled={submitted}
        />
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
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-6 pt-4">
        <button
          type="submit"
          disabled={submitted || !name.trim()}
          aria-busy={submitted}
          className={cn(
            "border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest",
            "hover:border-accent hover:text-accent transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none",
          )}
        >
          {submitted ? "Creating… (demo)" : "Create auction"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/auctions")}
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <p className="mt-8 font-mono text-[10px] text-muted-foreground/70 border border-border/40 px-3 py-2">
        Demo: form data is not persisted. In production you would connect a wallet, deploy or register the auction onchain, and set name, description, reserve price, and duration in the CCA contract.
      </p>
    </form>
  )
}
