const { expect } = require('chai');
const { ethers } = require('hardhat');

function getSelectors(contract) {
  const Ethers = require('ethers');
  return contract.interface.fragments
    .filter((f) => f.type === 'function')
    .map((f) => {
      const sig = `${f.name}(${f.inputs.map((i) => i.type).join(',')})`;
      return Ethers.keccak256(Ethers.toUtf8Bytes(sig)).slice(0, 10);
    });
}

describe('Init and Revert Facet tests', function () {
  it('TestInitFacet initNoop emits event (direct)', async function () {
    const [caller] = await ethers.getSigners();
    const TestInitFacet = await ethers.getContractFactory('TestInitFacet');
    const testInit = await TestInitFacet.deploy();
    await testInit.waitForDeployment();

    await expect(testInit.initNoop()).to.emit(testInit, 'Inited').withArgs(caller.address);
  });

  it('TestRevertFacet willRevert reverts (direct)', async function () {
    const TestRevertFacet = await ethers.getContractFactory('TestRevertFacet');
    const rev = await TestRevertFacet.deploy();
    await rev.waitForDeployment();

    await expect(rev.willRevert()).to.be.revertedWith('TestRevertFacet: revert');
  });

  it('Call initNoop and willRevert via Diamond (proxy) to cover facet-through-proxy paths', async function () {
    const [owner] = await ethers.getSigners();

    // deploy diamond supporting facets
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.waitForDeployment();

    const Ethers = require('ethers');
    const canonicalDiamondCutSig = 'diamondCut((address,uint8,bytes4[])[],address,bytes)';
    const diamondCutSelectors = [Ethers.keccak256(Ethers.toUtf8Bytes(canonicalDiamondCutSig)).slice(0, 10)];

    const Diamond = await ethers.getContractFactory('Diamond');
    const diamond = await Diamond.deploy(owner.address, diamondCutFacet.target || diamondCutFacet.address, diamondCutSelectors);
    await diamond.waitForDeployment();

    // deploy the facets
    const testInitC = await ethers.deployContract('TestInitFacet');
    await testInitC.waitForDeployment();
    const testRevC = await ethers.deployContract('TestRevertFacet');
    await testRevC.waitForDeployment();

    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const cut = [
      { facetAddress: testInitC.target || testInitC.address, action: FacetCutAction.Add, functionSelectors: getSelectors(testInitC) },
      { facetAddress: testRevC.target || testRevC.address, action: FacetCutAction.Add, functionSelectors: getSelectors(testRevC) }
    ];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    await diamondCut.diamondCut(cut, ethers.ZeroAddress, '0x');

    const testInitAtDiamond = await ethers.getContractAt('TestInitFacet', diamond.target || diamond.address);
    const testRevAtDiamond = await ethers.getContractAt('TestRevertFacet', diamond.target || diamond.address);

    // call initNoop via diamond
    await expect(testInitAtDiamond.initNoop()).to.not.be.reverted;

    // call willRevert via diamond and assert revert propagates
    await expect(testRevAtDiamond.willRevert()).to.be.revertedWith('TestRevertFacet: revert');
  });
});
