#!/usr/bin/env node
/*
 Simple CLI to interact with the diamond marketplace + NFT facet.

 Usage:
  - Start a local node (Hardhat) on http://127.0.0.1:8545 or set RPC_URL
  - Run: `node scripts/cli.js`
  - Optional env vars: RPC_URL, PRIVATE_KEY, DIAMOND_ADDRESS

 Notes:
  - This script reads ABIs from `artifacts/` so run after compilation or tests.
  - It's a lightweight helper for manual exploration, not production tooling.
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { ethers } = require('ethers');

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY || null; // optional

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

function loadAbi(relpath) {
  const p = path.resolve(__dirname, '..', relpath);
  if (!fs.existsSync(p)) throw new Error('ABI not found: ' + p);
  const json = JSON.parse(fs.readFileSync(p, 'utf8'));
  return json.abi;
}

async function main() {
  console.log('Connecting to', RPC_URL);
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  let signer;
  if (PRIVATE_KEY) {
    signer = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log('Using wallet from PRIVATE_KEY:', signer.address);
  } else {
    try {
      signer = provider.getSigner(0);
      const addr = await signer.getAddress();
      console.log('Using unlocked account[0]:', addr);
    } catch (e) {
      console.error('No signer available. Set PRIVATE_KEY or run against a local node with unlocked accounts.');
      process.exit(1);
    }
  }

  const diamondAddrEnv = process.env.DIAMOND_ADDRESS || '';
  let diamondAddress = diamondAddrEnv;
  if (!diamondAddress) diamondAddress = (await ask('Diamond address (proxy) to use: ')).trim();
  if (!diamondAddress) { console.error('Diamond address required.'); process.exit(1); }

  // artifact paths (relative to repo root)
  const nftAbiPath = 'artifacts/contracts/facets/NFTFacet.sol/NFTFacet.json';
  const marketplaceAbiPath = 'artifacts/contracts/facets/MarketplaceFacet.sol/MarketplaceFacet.json';

  const nftAbi = loadAbi(nftAbiPath);
  const marketplaceAbi = loadAbi(marketplaceAbiPath);

  const nft = new ethers.Contract(diamondAddress, nftAbi, signer);
  const market = new ethers.Contract(diamondAddress, marketplaceAbi, signer);

  async function showMenu() {
    console.log('\nChoose an action:');
    console.log(' 1) View token info (ownerOf, tokenURI, balanceOf)');
    console.log(' 2) Mint NFT (owner only)');
    console.log(' 3) Approve marketplace for token (approve)');
    console.log(' 4) Set approval for all (setApprovalForAll)');
    console.log(' 5) List NFT for sale (listItem)');
    console.log(' 6) Buy item (buyItem)');
    console.log(' 7) Cancel listing (cancelListing)');
    console.log(' 8) Update listing price (updateListingPrice)');
    console.log(' 9) Withdraw fees (owner)');
    console.log('10) Transfer NFT (transferFrom)');
    console.log('11) Get listing details');
    console.log('0) Exit');
    const choice = (await ask('> ')).trim();
    return choice;
  }

  async function viewToken() {
    const tokenId = (await ask('tokenId: ')).trim();
    try {
      const owner = await nft.ownerOf(BigInt(tokenId));
      const uri = await nft.tokenURI(BigInt(tokenId));
      console.log('owner:', owner);
      console.log('tokenURI:', uri);
      const balance = await nft.balanceOf(await signer.getAddress());
      console.log('your balance:', balance.toString());
    } catch (e) { console.error('err', e.message || e); }
  }

  async function mint() {
    const to = (await ask('recipient address: ')).trim() || await signer.getAddress();
    const uri = (await ask('tokenURI: ')).trim();
    try {
      const tx = await nft.mintNFT(to, uri);
      console.log('tx sent:', tx.hash);
      await tx.wait();
      console.log('minted');
    } catch (e) { console.error('err', e.message || e); }
  }

  async function approveToken() {
    const tokenId = (await ask('tokenId: ')).trim();
    try {
      const tx = await nft.approve(diamondAddress, BigInt(tokenId));
      console.log('tx:', tx.hash); await tx.wait(); console.log('approved');
    } catch (e) { console.error('err', e.message || e); }
  }

  async function setApprovalAll() {
    const flag = (await ask('approve? (y/n): ')).trim().toLowerCase() === 'y';
    try {
      const tx = await nft.setApprovalForAll(diamondAddress, flag);
      console.log('tx:', tx.hash); await tx.wait(); console.log('done');
    } catch (e) { console.error('err', e.message || e); }
  }

  async function listItem() {
    const nftContract = (await ask('nftContract address (or enter diamond to use proxy NFT facet): ')).trim() || diamondAddress;
    const tokenId = BigInt((await ask('tokenId: ')).trim());
    const price = (await ask('price in ETH: ')).trim();
    const priceWei = ethers.parseEther(price || '0');
    try {
      const tx = await market.listItem(nftContract, tokenId, priceWei);
      console.log('tx:', tx.hash); await tx.wait(); console.log('listed');
    } catch (e) { console.error('err', e.message || e); }
  }

  async function buyItem() {
    const itemId = BigInt((await ask('itemId: ')).trim());
    const nftContract = (await ask('nftContract address (or enter diamond to use proxy NFT facet): ')).trim() || diamondAddress;
    const tokenId = BigInt((await ask('tokenId: ')).trim());
    const value = (await ask('send value in ETH (exact price recommended): ')).trim();
    const valueWei = ethers.parseEther(value || '0');
    try {
      const tx = await market.buyItem(itemId, nftContract, tokenId, { value: valueWei });
      console.log('tx:', tx.hash); await tx.wait(); console.log('bought');
    } catch (e) { console.error('err', e.message || e); }
  }

  async function cancelListing() {
    const itemId = BigInt((await ask('itemId: ')).trim());
    const nftContract = (await ask('nftContract address (or enter diamond): ')).trim() || diamondAddress;
    const tokenId = BigInt((await ask('tokenId: ')).trim());
    try {
      const tx = await market.cancelListing(itemId, nftContract, tokenId);
      console.log('tx:', tx.hash); await tx.wait(); console.log('canceled');
    } catch (e) { console.error('err', e.message || e); }
  }

  async function updateListingPrice() {
    const itemId = BigInt((await ask('itemId: ')).trim());
    const newPrice = (await ask('new price in ETH: ')).trim();
    const newPriceWei = ethers.parseEther(newPrice || '0');
    try {
      const tx = await market.updateListingPrice(itemId, newPriceWei);
      console.log('tx:', tx.hash); await tx.wait(); console.log('updated');
    } catch (e) { console.error('err', e.message || e); }
  }

  async function withdrawFees() {
    try { const tx = await market.withdrawFees(); console.log('tx:', tx.hash); await tx.wait(); console.log('withdrawn'); }
    catch (e) { console.error('err', e.message || e); }
  }

  async function transferNFT() {
    const from = (await ask('from address (must be your address or you must be approved): ')).trim();
    const to = (await ask('to address: ')).trim();
    const tokenId = BigInt((await ask('tokenId: ')).trim());
    try { const tx = await nft.transferFrom(from, to, tokenId); console.log('tx:', tx.hash); await tx.wait(); console.log('transferred'); }
    catch (e) { console.error('err', e.message || e); }
  }

  async function getListing() {
    const itemId = BigInt((await ask('itemId: ')).trim());
    try {
      const listing = await market.getListing(itemId);
      console.log('listing:', listing);
    } catch (e) { console.error('err', e.message || e); }
  }

  while (true) {
    const choice = await showMenu();
    try {
      if (choice === '1') await viewToken();
      else if (choice === '2') await mint();
      else if (choice === '3') await approveToken();
      else if (choice === '4') await setApprovalAll();
      else if (choice === '5') await listItem();
      else if (choice === '6') await buyItem();
      else if (choice === '7') await cancelListing();
      else if (choice === '8') await updateListingPrice();
      else if (choice === '9') await withdrawFees();
      else if (choice === '10') await transferNFT();
      else if (choice === '11') await getListing();
      else if (choice === '0') { console.log('bye'); process.exit(0); }
      else console.log('unknown choice');
    } catch (e) {
      console.error('action failed', e && e.message ? e.message : e);
    }
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
