const fs = require('fs');
const path = require('path');

async function main() {
  // Deploy NFT contract
  const MyNFT = await hre.ethers.getContractFactory("MyNFT");
  const myNFT = await MyNFT.deploy();
  await myNFT.deployed();
  console.log("MyNFT deployed to:", myNFT.address);

  // Deploy Marketplace contract
  const Marketplace = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await Marketplace.deploy();
  await marketplace.deployed();
  console.log("Marketplace deployed to:", marketplace.address);

  // Save contract addresses to a configuration file
  const config = {
    MyNFTAddress: myNFT.address,
    MarketplaceAddress: marketplace.address,
    network: hre.network.name
  };

  const configFilePath = path.join(__dirname, '..', 'config', 'deployedAddresses.json');
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
  console.log(`Contract addresses saved to ${configFilePath}`);

  // Verify contracts on Etherscan
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting for block confirmations...");
    await myNFT.deployTransaction.wait(6);
    await marketplace.deployTransaction.wait(6);

    await hre.run("verify:verify", {
      address: myNFT.address,
      constructorArguments: [],
    });

    await hre.run("verify:verify", {
      address: marketplace.address,
      constructorArguments: [],
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
