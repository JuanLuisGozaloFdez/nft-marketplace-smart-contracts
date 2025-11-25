/**
 * Simpler approach: Just get diamond address from running a simple contract interaction
 */
const hre = require('hardhat');

async function main() {
  console.log('Getting signers...');
  const [deployer] = await hre.ethers.getSigners();
  
  console.log('Deploying contracts...');
  
  // Deploy all
  const factories = {
    dcf: await hre.ethers.getContractFactory('DiamondCutFacet'),
    d: await hre.ethers.getContractFactory('Diamond'),
    dlf: await hre.ethers.getContractFactory('DiamondLoupeFacet'),
    of: await hre.ethers.getContractFactory('OwnershipFacet'),
    nf: await hre.ethers.getContractFactory('NFTFacet'),
    mf: await hre.ethers.getContractFactory('MarketplaceFacet'),
  };

  const dcf = await factories.dcf.deploy();
  await dcf.waitForDeployment();
  const dcfAddr = await dcf.getAddress();
  console.log('✓ DiamondCutFacet:', dcfAddr);

  // Build selectors from factory ABI
  const dcfSelectors = [];
  for (const item of factories.dcf.interface.fragments) {
    if (item.type === 'function') {
      const iface = new hre.ethers.Interface([item]);
      dcfSelectors.push(iface.getSighash(item.name));
    }
  }

  const diamond = await factories.d.deploy(deployer.address, dcfAddr, dcfSelectors);
  await diamond.waitForDeployment();
  const dAddr = await diamond.getAddress();
  console.log('✓ Diamond:', dAddr);

  // Deploy remaining
  const dlf = await factories.dlf.deploy();
  await dlf.waitForDeployment();
  console.log('✓ DiamondLoupeFacet:', await dlf.getAddress());

  const of = await factories.of.deploy();
  await of.waitForDeployment();
  console.log('✓ OwnershipFacet:', await of.getAddress());

  const nf = await factories.nf.deploy();
  await nf.waitForDeployment();
  console.log('✓ NFTFacet:', await nf.getAddress());

  const mf = await factories.mf.deploy();
  await mf.waitForDeployment();
  console.log('✓ MarketplaceFacet:', await mf.getAddress());

  console.log('\nApplying diamond cuts...');

  // Build cuts
  const buildSelectors = (factory) => {
    const sels = [];
    for (const item of factory.interface.fragments) {
      if (item.type === 'function') {
        const iface = new hre.ethers.Interface([item]);
        sels.push(iface.getSighash(item.name));
      }
    }
    return sels;
  };

  const cuts = [
    { facetAddress: await dlf.getAddress(), action: 0, functionSelectors: buildSelectors(factories.dlf) },
    { facetAddress: await of.getAddress(), action: 0, functionSelectors: buildSelectors(factories.of) },
    { facetAddress: await nf.getAddress(), action: 0, functionSelectors: buildSelectors(factories.nf) },
    { facetAddress: await mf.getAddress(), action: 0, functionSelectors: buildSelectors(factories.mf) },
  ];

  const idc = await hre.ethers.getContractAt('IDiamondCut', dAddr);
  const tx = await idc.diamondCut(cuts, hre.ethers.ZeroAddress, '0x');
  await tx.wait();
  console.log('✓ Diamond cuts applied');

  console.log('\n' + '='.repeat(60));
  console.log('🎯 READY TO USE CLI!');
  console.log('='.repeat(60));
  console.log('\nDiamond deployed at: ' + dAddr);
  console.log('\n📝 Run the CLI:');
  console.log('   DIAMOND_ADDRESS=' + dAddr + ' node scripts/cli.js');
  console.log('\n💡 Or export the env var and run separately:');
  console.log('   export DIAMOND_ADDRESS=' + dAddr);
  console.log('   node scripts/cli.js');
}

main().catch(e => {
  console.error('\n❌ Error:', e.message);
  process.exit(1);
});
