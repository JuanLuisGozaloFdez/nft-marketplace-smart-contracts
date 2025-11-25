const { expect } = require('chai');
const { ethers } = require('hardhat');

function getSelectors(contract) {
  const Ethers = require('ethers');
  try {
    if (contract.interface && typeof contract.interface.getSighash === 'function') {
      return contract.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => contract.interface.getSighash(f));
    }
  } catch (e) {}
  return contract.interface.fragments
    .filter((f) => f.type === 'function')
    .map((f) => {
      const sig = `${f.name}(${f.inputs.map((i) => i.type).join(',')})`;
      return Ethers.keccak256(Ethers.toUtf8Bytes(sig)).slice(0, 10);
    });
}

describe('Diamond branches', function () {
  let owner;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
  });

  it('constructor with no diamondCutFacet should not add functions', async function () {
    const Diamond = await ethers.getContractFactory('Diamond');
    const diamond = await ethers.deployContract('Diamond', [owner.address, ethers.ZeroAddress, []]);
    await diamond.waitForDeployment();

    // Try calling owner() via OwnershipFacet ABI; should revert because no facet registered
    const ownership = await ethers.getContractAt('OwnershipFacet', diamond.target || diamond.address);
    await expect(ownership.owner()).to.be.revertedWith('Diamond: Function does not exist');
  });

  it('delegatecall failure path reverts with underlying message', async function () {
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await ethers.deployContract('DiamondCutFacet');
    await diamondCutFacet.waitForDeployment();

    const Ethers = require('ethers');
    const canonicalDiamondCutSig = 'diamondCut((address,uint8,bytes4[])[],address,bytes)';
    const diamondCutSelectors = [Ethers.keccak256(Ethers.toUtf8Bytes(canonicalDiamondCutSig)).slice(0, 10)];

    const Diamond = await ethers.getContractFactory('Diamond');
    const diamond = await ethers.deployContract('Diamond', [owner.address, diamondCutFacet.target || diamondCutFacet.address, diamondCutSelectors]);
    await diamond.waitForDeployment();

    // deploy revert facet and add it
    const TestRevertFacet = await ethers.getContractFactory('TestRevertFacet');
    const revertFacet = await TestRevertFacet.deploy();
    await revertFacet.waitForDeployment();

    const cut = [
      { facetAddress: revertFacet.target || revertFacet.address, action: 0, functionSelectors: getSelectors(revertFacet) }
    ];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    await diamondCut.diamondCut(cut, ethers.ZeroAddress, '0x');

    // call willRevert via diamond
    const viaDiamond = await ethers.getContractAt('TestRevertFacet', diamond.target || diamond.address);
    await expect(viaDiamond.willRevert()).to.be.revertedWith('TestRevertFacet: revert');
  });
});
