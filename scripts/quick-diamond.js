const hre = require('hardhat');

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying diamond...');

  // Deploy DiamondCutFacet
  const DCF = await hre.ethers.getContractFactory('DiamondCutFacet');
  const dcf = await DCF.deploy();
  await dcf.waitForDeployment();
  const dcfAddr = await dcf.getAddress();

  // Get selectors
  const selectors = [];
  const dcfAbi = DCF.interface;
  for (const [name, fn] of Object.entries(dcfAbi.functions)) {
    if (fn.type === 'function') {
      selectors.push(dcfAbi.getSighash(name));
    }
  }

  // Deploy Diamond
  const D = await hre.ethers.getContractFactory('Diamond');
  const diamond = await D.deploy(deployer.address, dcfAddr, selectors);
  await diamond.waitForDeployment();
  const diamondAddr = await diamond.getAddress();

  // Deploy facets
  const DLF = await hre.ethers.getContractFactory('DiamondLoupeFacet');
  const dlf = await DLF.deploy();
  await dlf.waitForDeployment();

  const OF = await hre.ethers.getContractFactory('OwnershipFacet');
  const of = await OF.deploy();
  await of.waitForDeployment();

  const NF = await hre.ethers.getContractFactory('NFTFacet');
  const nf = await NF.deploy();
  await nf.waitForDeployment();

  const MF = await hre.ethers.getContractFactory('MarketplaceFacet');
  const mf = await MF.deploy();
  await mf.waitForDeployment();

  console.log('Applying cuts...');

  // Apply cut
  const IDC = await hre.ethers.getContractAt('IDiamondCut', diamondAddr);
  const cut = [
    {
      facetAddress: await dlf.getAddress(),
      action: 0,
      functionSelectors: DLF.interface.fragments
        .filter(f => f.type === 'function')
        .map(f => DLF.interface.getSighash(f.name)),
    },
    {
      facetAddress: await of.getAddress(),
      action: 0,
      functionSelectors: OF.interface.fragments
        .filter(f => f.type === 'function')
        .map(f => OF.interface.getSighash(f.name)),
    },
    {
      facetAddress: await nf.getAddress(),
      action: 0,
      functionSelectors: NF.interface.fragments
        .filter(f => f.type === 'function')
        .map(f => NF.interface.getSighash(f.name)),
    },
    {
      facetAddress: await mf.getAddress(),
      action: 0,
      functionSelectors: MF.interface.fragments
        .filter(f => f.type === 'function')
        .map(f => MF.interface.getSighash(f.name)),
    },
  ];

  const tx = await IDC.diamondCut(cut, hre.ethers.ZeroAddress, '0x');
  await tx.wait();

  console.log('\n✅ SUCCESS!\n');
  console.log('Diamond Address:', diamondAddr);
  console.log('\n🎮 Start the CLI with:\n');
  console.log('   DIAMOND_ADDRESS=' + diamondAddr + ' node scripts/cli.js\n');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
