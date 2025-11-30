async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with', deployer.address);

  // Deploy DiamondCutFacet
  const DiamondCutFacet = await hre.ethers.getContractFactory('DiamondCutFacet');
  const diamondCutFacet = await DiamondCutFacet.deploy();
  await diamondCutFacet.waitForDeployment();
  const diamondCutAddr = await diamondCutFacet.getAddress();
  console.log('✓ DiamondCutFacet:', diamondCutAddr);

  // Get DiamondCutFacet selectors
  const diamondCutSelectors = Object.keys(diamondCutFacet.interface.functions)
    .map(sig => diamondCutFacet.interface.getSighash(sig));

  // Deploy Diamond
  const Diamond = await hre.ethers.getContractFactory('Diamond');
  const diamond = await Diamond.deploy(deployer.address, diamondCutAddr, diamondCutSelectors);
  await diamond.waitForDeployment();
  const diamondAddr = await diamond.getAddress();
  console.log('✓ Diamond:', diamondAddr);

  // Deploy other facets
  const DiamondLoupeFacet = await hre.ethers.getContractFactory('DiamondLoupeFacet');
  const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
  await diamondLoupeFacet.waitForDeployment();
  console.log('✓ DiamondLoupeFacet:', await diamondLoupeFacet.getAddress());

  const OwnershipFacet = await hre.ethers.getContractFactory('OwnershipFacet');
  const ownershipFacet = await OwnershipFacet.deploy();
  await ownershipFacet.waitForDeployment();
  console.log('✓ OwnershipFacet:', await ownershipFacet.getAddress());

  const NFTFacet = await hre.ethers.getContractFactory('NFTFacet');
  const nftFacet = await NFTFacet.deploy();
  await nftFacet.waitForDeployment();
  console.log('✓ NFTFacet:', await nftFacet.getAddress());

  const MarketplaceFacet = await hre.ethers.getContractFactory('MarketplaceFacet');
  const marketplaceFacet = await MarketplaceFacet.deploy();
  await marketplaceFacet.waitForDeployment();
  console.log('✓ MarketplaceFacet:', await marketplaceFacet.getAddress());

  // Cut: Add facets
  const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
  const cut = [
    {
      facetAddress: await diamondLoupeFacet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: Object.keys(diamondLoupeFacet.interface.functions)
        .map(sig => diamondLoupeFacet.interface.getSighash(sig))
    },
    {
      facetAddress: await ownershipFacet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: Object.keys(ownershipFacet.interface.functions)
        .map(sig => ownershipFacet.interface.getSighash(sig))
    },
    {
      facetAddress: await nftFacet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: Object.keys(nftFacet.interface.functions)
        .map(sig => nftFacet.interface.getSighash(sig))
    },
    {
      facetAddress: await marketplaceFacet.getAddress(),
      action: FacetCutAction.Add,
      functionSelectors: Object.keys(marketplaceFacet.interface.functions)
        .map(sig => marketplaceFacet.interface.getSighash(sig))
    }
  ];

  const diamondCut = await hre.ethers.getContractAt('IDiamondCut', diamondAddr);
  const tx = await diamondCut.diamondCut(cut, hre.ethers.ZeroAddress, '0x');
  await tx.wait();
  console.log('✓ Diamond cut completed');

  console.log('\n🎯 Diamond Address:', diamondAddr);
  console.log('📝 Use with CLI: DIAMOND_ADDRESS=' + diamondAddr + ' node scripts/cli.js');
}

main().catch(console.error);
