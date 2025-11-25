# Interactive CLI Launcher Guide

## Overview

The NFT Marketplace includes an interactive command-line interface (CLI) to interact with the smart contracts. This guide shows you exactly how to launch it with all prerequisites.

## Prerequisites Checklist

- [x] Node.js 16+ installed
- [x] Project dependencies installed (`npm install`)
- [x] Contracts compiled (`npx hardhat compile` or `npx hardhat test`)
- [ ] Hardhat local node running
- [ ] Diamond proxy deployed
- [ ] CLI launched

## Step-by-Step Launch

### **Step 1: Start the Local Hardhat Node** *(Terminal 1)*

```bash
cd /home/jlg/nft/nft-marketplace-smart-contracts
npx hardhat node
```

**Output should show:**
```
WARNING: These accounts, and their private keys, are publicly known.
Any funds sent to them on Mainnet or any other live network WILL BE LOST.

Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Account #1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)
...
```

**⚠️ Keep this terminal running throughout the session.**

### **Step 2: Deploy the Diamond** *(Terminal 2)*

While the node is running in Terminal 1, open a new terminal and deploy:

```bash
cd /home/jlg/nft/nft-marketplace-smart-contracts
npx hardhat run scripts/deploy.js --network localhost
```

Or use the test suite to deploy:

```bash
npx hardhat test --grep "Marketplace" --network localhost
```

**Output should show:**
```
Deploying with 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
DiamondCutFacet deployed: 0x...
Diamond deployed: 0x5FbDB2315678afccb333f8a9c604b434d100Cf46
...
```

**📝 Note the Diamond address** (e.g., `0x5FbDB2315678afccb333f8a9c604b434d100Cf46`)

### **Step 3: Launch the CLI** *(Terminal 3)*

Open a third terminal and launch the CLI with the Diamond address:

```bash
cd /home/jlg/nft/nft-marketplace-smart-contracts
DIAMOND_ADDRESS=0x5FbDB2315678afccb333f8a9c604b434d100Cf46 node scripts/cli.js
```

Or, if you prefer to set the environment variable first:

```bash
export DIAMOND_ADDRESS=0x5FbDB2315678afccb333f8a9c604b434d100Cf46
export RPC_URL=http://127.0.0.1:8545
node scripts/cli.js
```

**If Diamond address is not set, the CLI will prompt:**
```
Diamond address (proxy) to use: 0x5FbDB2315678afccb333f8a9c604b434d100Cf46
```

### **Step 4: Use the CLI Menu**

Once launched, you'll see:

```
Connecting to http://127.0.0.1:8545
Using unlocked account[0]: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

Choose an action:
 1) View token info (ownerOf, tokenURI, balanceOf)
 2) Mint NFT (owner only)
 3) Approve marketplace for token (approve)
 4) Set approval for all (setApprovalForAll)
 5) List NFT for sale (listItem)
 6) Buy item (buyItem)
 7) Cancel listing (cancelListing)
 8) Update listing price (updateListingPrice)
 9) Withdraw fees (owner)
10) Transfer NFT (transferFrom)
11) Get listing details
 0) Exit
>
```

### **Step 5: Try a Simple Flow**

1. **Mint an NFT** (enter `2`)
   ```
   recipient address (press enter for self): [enter]
   tokenURI: https://example.com/nft/1
   ✓ minted
   ```

2. **Approve marketplace** (enter `3`)
   ```
   tokenId: 1
   ✓ approved
   ```

3. **List it for sale** (enter `5`)
   ```
   nftContract address (or enter diamond): [enter]
   tokenId: 1
   price in ETH: 10
   ✓ listed
   ```

4. **Check the listing** (enter `11`)
   ```
   itemId: 1
   ✓ Shows listing details
   ```

5. **Exit** (enter `0`)

## Environment Variables Reference

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `RPC_URL` | JSON-RPC endpoint | `http://127.0.0.1:8545` | `http://localhost:8545` |
| `DIAMOND_ADDRESS` | Diamond proxy address | (prompted if not set) | `0x5FbDB...` |
| `PRIVATE_KEY` | Account private key | (uses unlocked account 0) | `0xac09...` |

### Using a Different Account

To interact as Account #1 (instead of Account #0):

```bash
export PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
export DIAMOND_ADDRESS=0x5FbDB2315678afccb333f8a9c604b434d100Cf46
node scripts/cli.js
```

(Account #1 private key from Hardhat node output)

## Complete Multi-Terminal Example

**Terminal 1 — Start Node:**
```bash
cd /home/jlg/nft/nft-marketplace-smart-contracts && npx hardhat node
```

**Terminal 2 — Deploy (wait 2-3 seconds after node starts):**
```bash
cd /home/jlg/nft/nft-marketplace-smart-contracts && sleep 3 && npx hardhat run scripts/deploy.js --network localhost
```

**Terminal 3 — Run CLI (after deployment completes):**
```bash
cd /home/jlg/nft/nft-marketplace-smart-contracts
export DIAMOND_ADDRESS=0x5FbDB2315678afccb333f8a9c604b434d100Cf46  # Replace with your address
node scripts/cli.js
```

## Troubleshooting

### "Cannot connect to the network localhost"
- Ensure Hardhat node is running in Terminal 1
- Verify `http://127.0.0.1:8545` is accessible
- Check no firewall is blocking port 8545

### "ABI not found"
- Run `npx hardhat compile` to generate ABIs in `artifacts/`
- ABIs must be present in `artifacts/contracts/facets/NFTFacet.sol/NFTFacet.json`

### "No signer available"
- Use a Hardhat local node (which has unlocked accounts)
- Or set `PRIVATE_KEY` environment variable
- Local node comes with 20 pre-funded test accounts

### "Diamond address required"
- Pass as environment variable: `DIAMOND_ADDRESS=0x... node scripts/cli.js`
- Or enter it when prompted by the CLI

## Common Workflows

### Workflow 1: Mint & Sell an NFT

1. **Action 2** — Mint (creates token ID 1)
2. **Action 3** — Approve (allows marketplace to transfer it)
3. **Action 5** — List (adds to marketplace)
4. **Switch account** (set different PRIVATE_KEY)
5. **Action 6** — Buy (transfer happens atomically)
6. **Switch back** (original owner)
7. **Action 9** — Withdraw fees

### Workflow 2: Multiple Approvals

1. **Action 4** — Set approval for all (grants operator role)
2. **Switch account** (operator)
3. **Action 5** — List any token from owner (approved as operator)
4. **Action 10** — Transfer to yourself

## File Locations

- **CLI Script:** `scripts/cli.js`
- **Deploy Script:** `scripts/deploy.js`
- **NFT Facet ABI:** `artifacts/contracts/facets/NFTFacet.sol/NFTFacet.json`
- **Marketplace Facet ABI:** `artifacts/contracts/facets/MarketplaceFacet.sol/MarketplaceFacet.json`
- **Diamond ABI:** `artifacts/contracts/Diamond.sol/Diamond.json`

## Next Steps

- See `CLI.md` for detailed CLI menu documentation
- See `README.md` for contract architecture overview
- Explore `test/` directory for usage examples
- Check `contracts/facets/` for function implementations

## Support

If you encounter issues:
1. Check Hardhat node logs (Terminal 1)
2. Verify Diamond address is correct
3. Ensure you have sufficient ETH (use unlocked test accounts)
4. See troubleshooting section above

---

**Now you're ready to interact with the NFT Marketplace! Start with Step 1 above.** 🚀

---

## Current Session Status

✅ **Hardhat Node**: Running on http://127.0.0.1:8545

To complete the setup and launch the CLI in your current session:

```bash
# Terminal 2 (if not already done):
npx hardhat run scripts/deploy.js --network localhost

# Terminal 3:
DIAMOND_ADDRESS=0x... node scripts/cli.js
```

Replace `0x...` with the Diamond address from the deployment output in Terminal 2.

---
