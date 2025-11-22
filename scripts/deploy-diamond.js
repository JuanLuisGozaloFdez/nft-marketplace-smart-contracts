const fs = require('fs');
const path = require('path');

function getSelectors(contract) {
  const signatures = Object.keys(contract.interface.functions);
  return signatures.map((sig) => contract.interface.getSighash(sig));
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with', deployer.address);

  // Deploy DiamondCutFacet first
  const DiamondCutFacet = await hre.ethers.getContractFactory('DiamondCutFacet');
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.deployed();
  console.log('DiamondCutFacet deployed:', diamondCutFacet.address);

  // Prepare selectors for Diamond constructor to register diamondCut
  const diamondCutSelectors = getSelectors(diamondCutFacet);

  // Deploy Diamond, registering DiamondCutFacet selectors at construction
  const Diamond = await hre.ethers.getContractFactory('Diamond');
  const diamond = await Diamond.deploy(deployer.address, diamondCutFacet.address, diamondCutSelectors);
  await diamond.deployed();
  console.log('Diamond deployed:', diamond.address);

  // Deploy other facets
  const DiamondLoupeFacet = await hre.ethers.getContractFactory('DiamondLoupeFacet');
  const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
  await diamondLoupeFacet.deployed();
  console.log('DiamondLoupeFacet deployed:', diamondLoupeFacet.address);

  const OwnershipFacet = await hre.ethers.getContractFactory('OwnershipFacet');
  const ownershipFacet = await OwnershipFacet.deploy();
  await ownershipFacet.deployed();
  console.log('OwnershipFacet deployed:', ownershipFacet.address);

  const NFTFacet = await hre.ethers.getContractFactory('NFTFacet');
  const nftFacet = await NFTFacet.deploy();
  await nftFacet.deployed();
  console.log('NFTFacet deployed:', nftFacet.address);

  const MarketplaceFacet = await hre.ethers.getContractFactory('MarketplaceFacet');
  const marketplaceFacet = await MarketplaceFacet.deploy();
  await marketplaceFacet.deployed();
  console.log('MarketplaceFacet deployed:', marketplaceFacet.address);

  // Build cut
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  const cut = [
    { facetAddress: diamondLoupeFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(diamondLoupeFacet) },
    { facetAddress: ownershipFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(ownershipFacet) },
    { facetAddress: nftFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(nftFacet) },
    { facetAddress: marketplaceFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(marketplaceFacet) }
  ];

  // Execute diamondCut on the Diamond (diamond already has diamondCut selector registered)
  const diamondCut = await hre.ethers.getContractAt('DiamondCutFacet', diamond.address);
  console.log('Executing diamondCut to add facets...');
  const tx = await diamondCut.diamondCut(cut, hre.ethers.constants.AddressZero, '0x');
  await tx.wait();
  console.log('diamondCut executed');

  // Initialize NFT and Marketplace via the diamond
  const nft = await hre.ethers.getContractAt('NFTFacet', diamond.address);
  const marketplace = await hre.ethers.getContractAt('MarketplaceFacet', diamond.address);

  // Initialize storage values
  await nft.initNFT('MyNFT', 'MNFT', 10000);
  await marketplace.initMarketplace(25);

  // Save addresses
  const config = {
    DiamondAddress: diamond.address,
    facets: {
      diamondCutFacet: diamondCutFacet.address,
      diamondLoupeFacet: diamondLoupeFacet.address,
      ownershipFacet: ownershipFacet.address,
      nftFacet: nftFacet.address,
      marketplaceFacet: marketplaceFacet.address
    },
    network: hre.network.name
  };

  const configFilePath = path.join(__dirname, '..', 'config', 'deployedAddresses.json');
  fs.mkdirSync(path.dirname(configFilePath), { recursive: true });
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
  console.log(`Contract addresses saved to ${configFilePath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });