const hre = require("hardhat");
const { parseArgs } = require("node:util");

async function main() {
  const { values } = parseArgs({
    options: {
      address: {
        type: "string",
        short: "a",
        description: "Diamond contract address (contains NFTFacet)"
      },
      uri: {
        type: "string",
        short: "u",
        description: "Token URI"
      }
    }
  });

  const [owner] = await hre.ethers.getSigners();

  // Get the contract instance (NFTFacet via Diamond address)
  const contractAddress = values.address || "YOUR_DIAMOND_ADDRESS";
  const nft = await hre.ethers.getContractAt('NFTFacet', contractAddress);

  console.log("Minting NFT from:", owner.address);

  // Mint a new NFT
  const tokenURI = values.uri || "https://example.com/nft/1";
  const tx = await nft.mintNFT(owner.address, tokenURI);
  const receipt = await tx.wait();

  // Parse event to get tokenId
  const event = receipt.events.find((e) => e.event === 'NFTMinted');
  if (event) {
    console.log('NFT minted successfully, tokenId:', event.args[0].toString());
  } else {
    console.log('NFT minted (no event parsed)');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
  