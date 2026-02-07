# Try the encrypted bidding flow

What **you** need to do, and in what order.

---

## What we need from you

1. **A wallet** (e.g. MetaMask) with **Sepolia ETH** for gas.  
   Get testnet ETH from a [Sepolia faucet](https://sepoliafaucet.com/) if needed.

2. **One private key use (one-time only):** to deploy the **BlindPoolFactory** so the app can offer the “Deploy BlindPool” button. After that, everything else is from the UI with MetaMask (no key in terminal).

3. **An auction** you want to try. You already have one:  
   `0x25B5C66f17152F36eE858709852C4BDbB8d71DF5`

---

## Step-by-step

### 1. Deploy BlindPoolFactory once (terminal + your key)

From your machine, in the `cca` folder:

```bash
cd cca
# Put your wallet private key in .env (see .env.example)
# PRIVATE_KEY=0x...   (the wallet that has Sepolia ETH)

forge script script/DeployBlindPoolFactory.s.sol \
  --rpc-url https://1rpc.io/sepolia \
  --broadcast \
  --private-key $PRIVATE_KEY
```

- If you use `.env`, run: `source .env` (or put `PRIVATE_KEY=0x...` in `.env` and run `export $(grep -v '^#' .env | xargs)`), then the same `forge script` command.
- **Copy the printed factory address** (e.g. `BlindPoolFactory deployed to: 0x...`).

---

### 2. Configure the app

In **nextui-starter4**:

1. Create or edit **`.env.local`** in the project root.
2. Add (use the address from step 1):

```bash
NEXT_PUBLIC_BLIND_POOL_FACTORY_ADDRESS=0xYourFactoryAddressFromStep1
```

3. Restart the dev server:

```bash
npm run dev
```

---

### 3. Try the flow in the browser

1. **Open the app** (e.g. http://localhost:3000).
2. **Connect your wallet** (MetaMask) and switch to **Sepolia**.
3. Go to **Auctions** and open **your auction**  
   (e.g. open the one at `0x25B5C66f17152F36eE858709852C4BDbB8d71DF5` via the list or URL).
4. On the auction page, find the **“Sealed bids (BlindPool)”** section.
5. Click **“Deploy BlindPool for this auction”**  
   → MetaMask will ask you to sign and pay gas. Confirm.  
   → After the tx confirms, the page will show the new BlindPool address and the place-bid form will use it for **encrypted** bids.
6. **Place a sealed bid:** enter amount (ETH) and max price, then submit.  
   → The app will encrypt with Zama and call `submitBlindBid` on the BlindPool. Confirm in MetaMask again.
7. **Later (after blind-bid deadline):** someone must call `requestReveal()` on the BlindPool, then decrypt off-chain and call `forwardBidToCCA` for each bid. See **ZAMA_ENCRYPTED_BIDDING.md** for that phase.

---

## Checklist (what you need to provide)

| Item | What to do |
|------|------------|
| Wallet with Sepolia ETH | Use MetaMask (or similar) and fund it from a faucet if needed. |
| Private key for one-time factory deploy | Put it in `cca/.env` as `PRIVATE_KEY=0x...` and run the `forge script` in step 1. Do not share this key. |
| Factory address in app | After step 1, set `NEXT_PUBLIC_BLIND_POOL_FACTORY_ADDRESS=0x...` in `nextui-starter4/.env.local`. |
| Auction to use | You already have one; use it or create another from the app. |

---

## Quick reference

- **Auction (CCA):** `0x25B5C66f17152F36eE858709852C4BDbB8d71DF5`
- **One-time:** Deploy factory (step 1) → set env (step 2).
- **Every time you try:** Open app → connect wallet → open auction → “Deploy BlindPool” (if not done yet) → place sealed bid.
- **Reveal phase:** See **ZAMA_ENCRYPTED_BIDDING.md** (requestReveal → decrypt → forwardBidToCCA).