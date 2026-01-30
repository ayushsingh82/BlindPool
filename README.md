# BlindPool

**Privacy-focused fork of Uniswap's Continuous Clearing Auction (CCA) with sealed-bid configuration.**

## What It Is

[Uniswap's Continuous Clearing Auction (CCA)](https://docs.uniswap.org/) is a mechanism for **fair, continuous price discovery** and **liquidity bootstrapping** for a new token — all onchain and permissionless. Bids are automatically integrated over time to determine a market-clearing price and seed liquidity into a Uniswap pool when the auction ends.

**BlindPool** extends CCA by adding **sealed-bid / confidentiality features**: participants submit bids **privately**, so no one else (including bots or MEV actors) can see bid prices or identities before the auction closes. It resembles sealed-bid auctions in traditional finance, but built for onchain DeFi. Research in confidentiality on blockchains points toward **confidential compute** or **zero-knowledge (ZK)** techniques for this kind of privacy.

## Why It Matters

- **Reduces pre-bid sniping and front-running** — Bids stay hidden until the auction closes.
- **Prevents leakage of strategic bid information** that can be exploited by MEV bots.
- **Brings a more equitable token launch experience** — Fairer access for all participants.

## Risks & Challenges

- **Cryptographic privacy** — Must integrate ZK proofs and/or confidential compute.
- **Onchain enforceability and fairness** — Confidentiality must be verifiable and enforceable onchain.

## Tech Stack

- **Next.js** — App framework
- **Tailwind CSS** — Styling
- **Uniswap CCA** — Base mechanism (forked and extended for privacy)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the BlindPool app.

## Learn More

- [Uniswap CCA Documentation](https://docs.uniswap.org/)
- [Next.js Documentation](https://nextjs.org/docs)

---

© 2025 BlindPool. Privacy-first CCA. Sealed-bid token launches.
