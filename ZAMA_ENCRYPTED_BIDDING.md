# Zama Encrypted Bidding — How To

This guide explains how to **encrypt the two bid inputs** (amount and max price) with Zama fhEVM, and how **bid amount and total amount are revealed** after the auction ends — with either **auction creator decrypt** or **automatic reveal**.

---

## 1. The two inputs to encrypt

When a user places a bid, the CCA contract expects:

| Input        | Meaning              | Onchain (plain CCA) | With Zama (BlindPool)   |
|-------------|----------------------|----------------------|--------------------------|
| **Max price** | Willingness to pay (Q96) | `submitBid(maxPrice, …)` | **Encrypted** → `encMaxPrice` (euint64) |
| **Amount**    | ETH to commit (wei)  | `submitBid(…, amount, …)` + `msg.value` | **Encrypted** → `encAmount` (euint64) |

So you encrypt **exactly these two values**; nothing else in the bid needs to be encrypted for privacy. The contract you use for sealed bids is **BlindPoolCCA** (in the `cca/` repo), which stores `euint64 encMaxPrice` and `euint64 encAmount` and later forwards the decrypted pair to the real CCA.

---

## 2. High-level flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  DURING AUCTION (blind bidding)                                              │
│  • User enters: amount (ETH), max price (ETH per token)                      │
│  • Frontend: convert to wei + Q96, then encrypt with Zama Relayer SDK         │
│  • Tx: BlindPoolCCA.submitBlindBid(encMaxPrice, encAmount, inputProof)       │
│  • msg.value = user’s ETH (escrow; must cover worst-case amount)             │
│  → Nobody can read amount or max price onchain                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AFTER BLIND BID DEADLINE (reveal phase)                                     │
│  • Anyone calls BlindPoolCCA.requestReveal() (see “Who can call?” below)     │
│  • All stored ciphertexts become “publicly decryptable” via Zama KMS         │
│  → Bid values stay on-chain as ciphertext; decryption happens off-chain      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DECRYPT + FORWARD (before CCA endBlock)                                     │
│  • For each blind bid: relayer SDK publicDecrypt(encMaxPrice, encAmount)      │
│  • Get back clear maxPrice + amount + decryptionProof                        │
│  • Tx: BlindPoolCCA.forwardBidToCCA(bidId, maxPrice, amount, proof)          │
│  → Real CCA receives plain bid; settlement (exitBid, claimTokens) as usual  │
│  → Bid amount and total amount are now “revealed” (on CCA + in events)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

So: **encrypt the two inputs** in the place-bid form; **reveal** = make decryptable then decrypt and forward so the underlying CCA sees real amounts.

---

## 2.1 Who can call `requestReveal()`? Who is “someone”?

In the **current BlindPoolCCA contract**, `requestReveal()` has **no access control**: **anyone** can call it once `block.number >= blindBidDeadline`. So “someone” can be:

- The **auction creator** (they can do it from the app or a script).
- Any **bidder** or third party (e.g. a bot or a “Reveal” button in the UI that any user can press).
- A **backend / keeper** that watches the deadline and calls it automatically.

So it is **not** restricted to the auction creator by default. If you want only the auction creator to trigger reveal, you need to change the contract (e.g. add `onlyAdmin` or `onlyAuctionCreator` to `requestReveal()`).

---

## 2.2 Where can decrypted amounts be seen?

Decryption does **not** happen on-chain. It happens **off-chain** via Zama’s relayer (KMS):

1. **Off-chain (whoever runs the relayer):**  
   After `requestReveal()` has been called, you call the Zama relayer’s **publicDecrypt** (e.g. via `@zama-fhe/relayer-sdk`) with the encrypted handles for a bid. The relayer returns the **decrypted amount and max price** (and a proof) in the API response. So the decrypted values are visible **in the app or script** that calls the relayer (e.g. auction creator’s dashboard, your backend, or a bot).

2. **On-chain (everyone):**  
   When someone then calls **forwardBidToCCA(bidId, clearMaxPrice, clearAmount, proof)**, the plain values are sent to the **real CCA** contract. After that, the bid (and its amount) is **public on-chain**: in the CCA’s state, in **BidSubmitted** (and other) events, and on block explorers (e.g. Etherscan). So once a bid is forwarded, **everyone** can see that bid’s amount and max price on the CCA.

**Summary:** The **auction creator** (or whoever runs the relayer) sees decrypted amounts **first** in their relayer response. After **forwardBidToCCA** is used, those same amounts are **public on-chain** on the CCA and on explorers.

---

## 3. How to implement encrypted bidding (nextui-starter4)

### 3.1 Contract side (already in `cca/`)

- **BlindPoolCCA** wraps one CCA auction:
  - `submitBlindBid(encMaxPrice, encAmount, inputProof)` — stores encrypted amount and max price.
  - `requestReveal()` — after blind bid deadline; marks all ciphertexts publicly decryptable.
  - `forwardBidToCCA(blindBidId, clearMaxPrice, clearAmount, decryptionProof)` — reveals one bid to the CCA.

- Deploy BlindPoolCCA **per auction** (pointing to that auction’s CCA address), with a `blindBidDeadline` a few blocks before the CCA’s `endBlock`.

### 3.2 Frontend: encrypt the two inputs

1. **Install Zama Relayer SDK**

   ```bash
   npm install @zama-fhe/relayer-sdk
   ```

2. **Create a Zama instance (Sepolia)**

   Use the same config as in `cca/README.md` (ACL, KMS, InputVerifier, verifying contracts, chainId 11155111, relayer URL).

3. **In the “Place bid” form (instead of calling CCA directly)**

   - User inputs: **Amount (ETH)** and **Max price (ETH per token)**.
   - Convert to wei and Q96 (same as current plain CCA logic).
   - **Encrypt only these two values:**

   ```ts
   const input = instance.createEncryptedInput(blindPoolAddress, userAddress);
   input.add64(BigInt(maxPriceQ96));   // 1st encrypted input
   input.add64(BigInt(amountWei));     // 2nd encrypted input
   const encrypted = await input.encrypt();
   ```

   - Call **BlindPoolCCA** (not the CCA):

   ```ts
   await writeContract({
     address: blindPoolAddress,
     abi: BlindPoolABI,
     functionName: 'submitBlindBid',
     args: [encrypted.handles[0], encrypted.handles[1], encrypted.inputProof],
     value: amountWei,  // or max escrow if you cap differently
   });
   ```

So the **only** change in “what to send” is: the two numbers become two encrypted handles + one proof; the contract is BlindPoolCCA.

### 3.3 UX details

- **Auction page** must know whether this auction uses **plain CCA** or **BlindPoolCCA** (e.g. backend or config per auction).
- If BlindPool: show “Place sealed bid” and use the encrypted flow above; if plain CCA: keep current `submitBid` on the auction contract.
- **Latest bids**: for BlindPool you can show “Sealed” or count of blind bids until reveal; after forward, you can show the same “latest bids” from the underlying CCA if you read from it.

---

## 4. After auction ends: revealing bid amount and total amount

“Reveal” here means: (1) allow decryption of stored ciphertexts, and (2) actually decrypt and forward so the CCA (and thus everyone) sees real **bid amount** and **total amount**.

### 4.1 Who can call `requestReveal()`?

- **Current contract:** anyone can call `requestReveal()` after `blindBidDeadline`.
- So today it’s already **automatic** in the sense that no special role is required; any bot or frontend can call it once the deadline has passed.

### 4.2 Who can decrypt and forward?

- **Decryption** is done **off-chain** via Zama’s relayer (KMS). Once `requestReveal()` has been called, the relayer can decrypt any of the stored ciphertexts and return clear values + a proof.
- **Forward:** anyone can call `forwardBidToCCA(bidId, clearMaxPrice, clearAmount, proof)` as long as they have a valid `decryptionProof` from the relayer. So whoever runs the relayer (or has access to it) can get the decrypted (amount, max price) and submit the forward tx.

So in practice:

- **Option A — Auction creator decrypts**
  - **Restrict who may trigger reveal:** change `requestReveal()` so only `admin` (or auction creator) can call it. Then only the creator “opens” the envelope.
  - **Restrict who may forward:** keep `forwardBidToCCA` as-is; only someone with relayer access can get proofs. If only the auction creator runs the relayer (or has API keys), then effectively only the creator can decrypt and forward. Optionally you could add an `onlyAdmin` (or `onlyAuctionCreator`) modifier to `forwardBidToCCA` so that even with a proof, only the creator can submit the tx — then bid amount and total amount are only revealed when the creator runs the relayer and forwards.

- **Option B — Automatic reveal**
  - **Leave `requestReveal()` as public.** After `blindBidDeadline`, a keeper/bot or the frontend calls `requestReveal()` once.
  - **Run a small service or script** that:
    1. For each blind bid ID, calls the Zama relayer `publicDecrypt([encMaxPriceHandle, encAmountHandle])` (handles from the contract).
    2. Gets back clear (maxPrice, amount) and the decryption proof.
    3. Calls `forwardBidToCCA(bidId, maxPrice, amount, proof)`.
  - After all bids are forwarded, the real CCA has all bids; **bid amount and total amount** are visible on the CCA (and in events) as usual. So “automatic” = no manual step by the auction creator; a public relayer or your backend does decrypt + forward.

### 4.3 Summary table

| Aspect              | Auction creator decrypts (A)     | Automatic (B)                          |
|---------------------|-----------------------------------|----------------------------------------|
| Who calls `requestReveal()` | Only creator (add access control) | Anyone / bot / frontend                |
| Who gets decryption | Only creator (runs relayer)      | Relayer (public or your backend)       |
| Who calls `forwardBidToCCA` | Creator (optional: restrict to admin) | Bot / backend with relayer + proof     |
| When amounts visible| When creator runs relayer+forward | When bot/backend runs after reveal     |

---

## 5. Minimal code changes (nextui-starter4)

1. **Config**
   - Add per-auction: `ccaAddress` (current) and optional `blindPoolAddress`.
   - If `blindPoolAddress` is set, use encrypted flow; otherwise use current plain `submitBid` on `ccaAddress`.

2. **Place-bid form**
   - If BlindPool: use Zama relayer SDK to encrypt **amount (wei)** and **max price (Q96)** (the two inputs), then `submitBlindBid(handles[0], handles[1], proof)` with `value` as escrow.
   - If plain CCA: keep existing `submitBid(maxPrice, amount, owner, hookData)` with `value: amount`.

3. **After auction / blind deadline**
   - **Option A:** Creator-only: add `onlyAdmin` (or similar) to `requestReveal()` and optionally to `forwardBidToCCA` in BlindPoolCCA; creator runs relayer once and forwards all bids.
   - **Option B:** Automatic: call `requestReveal()` from the app or a script when `block.number >= blindBidDeadline`; run a small job that for each bid ID calls relayer `publicDecrypt` then `forwardBidToCCA`. Bid amount and total amount are then revealed on the CCA as usual.

---

## 6. References

- **cca/README.md** — BlindPool flow, Sepolia addresses, relayer SDK snippet.
- **cca/src/BlindPoolCCA.sol** — `submitBlindBid`, `requestReveal`, `forwardBidToCCA`; the two encrypted fields are `encMaxPrice` and `encAmount`.
- Zama fhEVM: [docs](https://docs.zama.org/protocol/solidity-guides), [Relayer SDK](https://docs.zama.org/protocol/relayer-sdk-guides).

So: **yes, the two inputs (amount and max price) are encrypted with Zama; after the auction ends, requestReveal + decrypt + forward makes bid amount and total amount visible on the CCA; you can make that “auction creator only” (access control + creator runs relayer) or “automatic” (anyone reveals, bot/relayer decrypts and forwards).**
