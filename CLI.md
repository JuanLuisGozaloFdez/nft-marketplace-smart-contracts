# Interactive CLI Guide

A simple command-line interface to interact with the NFT Marketplace smart contracts via the diamond proxy.

## Prerequisites

1. **Hardhat Node or JSON-RPC Endpoint**: Running a local Hardhat node or pointing to an external network
2. **Compiled Artifacts**: Run `npx hardhat compile` or `npx hardhat test` to generate ABIs in `artifacts/`
3. **Node.js 16+**: To run the CLI script
4. **ethers.js & inquirer**: Already in `devDependencies` (or install with `npm install`)

## Quick Start

### Step 1: Start a Local Hardhat Node

```bash
npx hardhat node
```

This starts a local network at `http://127.0.0.1:8545` with 20 unlocked test accounts, each with 10000 ETH.

### Step 2: Deploy the Diamond in Another Terminal

```bash
npx hardhat run scripts/deploy-diamond.js --network localhost
```

Note the deployed diamond address from the output. Example: `0x5FbDB2315678afccb333f8a9c604b434d100Cf46`

### Step 3: Run the CLI

**Option A: Auto-detect Diamond (prompted on start)**
```bash
node scripts/cli.js
```
- RPC_URL defaults to `http://127.0.0.1:8545`
- You'll be prompted for the diamond address

**Option B: Pass Everything as Environment Variables**
```bash
RPC_URL=http://127.0.0.1:8545 \
DIAMOND_ADDRESS=0x5FbDB2315678afccb333f8a9c604b434d100Cf46 \
node scripts/cli.js
```

**Option C: Use a Private Key**
```bash
PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef \
DIAMOND_ADDRESS=0x5FbDB2315678afccb333f8a9c604b434d100Cf46 \
node scripts/cli.js
```

## Example Workflow

### Scenario: Mint, Approve, List, and Buy an NFT

**Terminal 1: Run the CLI as Account 0 (owner)**
```
node scripts/cli.js
# Diamond address: 0x5FbDB2315678afccb333f8a9c604b434d100Cf46
# Choose: 2 (Mint NFT)
# Recipient: [press enter to mint to self]
# Token URI: https://example.com/nft/1
# ✓ NFT minted!

# Choose: 3 (Approve marketplace for token)
# Enter tokenId: 1
# ✓ Token approved for marketplace

# Choose: 5 (List NFT for sale)
# NFT contract address: [press enter to use diamond]
# Enter tokenId: 1
# Price in ETH: 10
# ✓ NFT listed for sale!
```

**Terminal 2: Run the CLI as Account 1 (buyer)**
```
PRIVATE_KEY=0x[account1_private_key] \
DIAMOND_ADDRESS=0x5FbDB2315678afccb333f8a9c604b434d100Cf46 \
node scripts/cli.js

# Choose: 6 (Buy item)
# Enter itemId: 1
# NFT contract address: [press enter]
# Enter tokenId: 1
# Send value in ETH: 10
# ✓ NFT purchased!
```

**Back to Terminal 1: Withdraw Fees**
```
# Choose: 9 (Withdraw fees)
# ✓ Fees withdrawn!
```

## CLI Menu Options

| Action | Function | Notes |
|--------|----------|-------|
| **1** View token info | `ownerOf()`, `tokenURI()`, `balanceOf()` | Read-only queries |
| **2** Mint NFT | `mintNFT()` | Owner-only |
| **3** Approve token | `approve()` | Approve marketplace for a single token |
| **4** Set approval for all | `setApprovalForAll()` | Operator approval |
| **5** List NFT for sale | `listItem()` | Requires token approval |
| **6** Buy item | `buyItem()` | Payable (send ETH) |
| **7** Cancel listing | `cancelListing()` | Seller-only |
| **8** Update listing price | `updateListingPrice()` | Seller-only |
| **9** Withdraw fees | `withdrawFees()` | Owner-only |
| **10** Transfer NFT | `transferFrom()` | Requires ownership or approval |
| **11** Get listing details | `getListing()` | Read-only query |
| **0** Exit | Exit the CLI | — |

## Environment Variables

| Variable | Default | Example |
|----------|---------|---------|
| `RPC_URL` | `http://127.0.0.1:8545` | `http://localhost:8545` or `https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY` |
| `PRIVATE_KEY` | (none, uses unlocked account 0) | `0x1234...abcd` |
| `DIAMOND_ADDRESS` | (prompted if not set) | `0x5FbDB2...f46` |

## Common Issues

### Issue: "No signer available"
**Solution**: Either set `PRIVATE_KEY` or run against a local Hardhat node with unlocked accounts.

### Issue: "ABI not found"
**Solution**: Run `npx hardhat compile` first to generate artifacts.

### Issue: "Diamond address required"
**Solution**: Pass `DIAMOND_ADDRESS=0x...` as an environment variable or enter it when prompted.

### Issue: Transaction fails with "NFT not approved"
**Solution**: Use menu option 3 or 4 to approve the marketplace before listing.

## Development Notes

- The CLI uses `ethers.js` for blockchain interaction and `inquirer` for prompts
- ABIs are loaded from `artifacts/contracts/facets/{NFTFacet,MarketplaceFacet}.sol/`
- Color-coded output: green (✓), yellow (⏳), red (✗), cyan (values), blue (info)
- This is a lightweight helper for local exploration and testing, not production tooling

## Next Steps

- Integrate with a frontend UI for a better user experience
- Add batch operations (e.g., "Approve + List in one step")
- Connect to testnets (Sepolia, Goerli) or mainnet for real NFT trading

