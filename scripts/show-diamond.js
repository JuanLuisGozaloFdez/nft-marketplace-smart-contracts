const hre = require('hardhat');

async function main() {
  const [owner] = await hre.ethers.getSigners();
  
  // Deploy a fresh diamond
  const DCF = await hre.ethers.getContractFactory('DiamondCutFacet');
  const dcf = await DCF.deploy();
  await dcf.waitForDeployment();
  
  const D = await hre.ethers.getContractFactory('Diamond');
  const diamond = await D.deploy(owner.address, await dcf.getAddress(), []);
  await diamond.waitForDeployment();
  
  console.log('\n🎯 Fresh Diamond Address:', await diamond.getAddress());
}

main().catch(console.error);
