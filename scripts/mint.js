const hre = require("hardhat");
const { parseArgs } = require("node:util");

async function main() {
  const { values } = parseArgs({
    options: {
      address: {
        type: "string",
        short: "a",
        description: "NFT contract address"
      },
      uri: {
        type: "string",
        short: "u",
        description: "Token URI"
      }
    }
  });

  const [owner] = await hre.ethers.getSigners();

  // Get the contract instance
  const MyNFT = await hre.ethers.getContractFactory("MyNFT");
  const contractAddress = values.address || "YOUR_DEPLOYED_NFT_CONTRACT_ADDRESS";
  const myNFT = await MyNFT.attach(contractAddress);

  console.log("Minting NFT from:", owner.address);

  // Mint a new NFT
  const tokenURI = values.uri || "https://example.com/nft/1";
  const tx = await myNFT.mintNFT(owner.address, tokenURI);
  await tx.wait();

  console.log("NFT minted successfully");

  // Get the latest token ID
  const latestTokenId = await myNFT.tokenIds();
  console.log("Minted NFT ID:", latestTokenId.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
  