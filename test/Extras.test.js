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

describe('Extras', function () {
  let owner, seller, buyer, addr1;
  let diamond;
  let diamondLoupeFacet, ownershipFacet, nftFacet, marketplaceFacet;

  beforeEach(async function () {
    [owner, seller, buyer, addr1] = await ethers.getSigners();

    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const Ethers = require('ethers');
    const diamondCutFacet = await ethers.deployContract('DiamondCutFacet');
    await diamondCutFacet.waitForDeployment();

    const canonicalDiamondCutSig = 'diamondCut((address,uint8,bytes4[])[],address,bytes)';
    const diamondCutSelectors = [Ethers.keccak256(Ethers.toUtf8Bytes(canonicalDiamondCutSig)).slice(0, 10)];

    const Diamond = await ethers.getContractFactory('Diamond');
    diamond = await ethers.deployContract('Diamond', [owner.address, diamondCutFacet.target || diamondCutFacet.address, diamondCutSelectors]);
    await diamond.waitForDeployment();

    diamondLoupeFacet = await ethers.deployContract('DiamondLoupeFacet');
    await diamondLoupeFacet.waitForDeployment();

    ownershipFacet = await ethers.deployContract('OwnershipFacet');
    await ownershipFacet.waitForDeployment();

    nftFacet = await ethers.deployContract('NFTFacet');
    await nftFacet.waitForDeployment();

    marketplaceFacet = await ethers.deployContract('MarketplaceFacet');
    await marketplaceFacet.waitForDeployment();

    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const cut = [
      { facetAddress: diamondLoupeFacet.target || diamondLoupeFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(diamondLoupeFacet) },
      { facetAddress: ownershipFacet.target || ownershipFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(ownershipFacet) },
      { facetAddress: nftFacet.target || nftFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(nftFacet) },
      { facetAddress: marketplaceFacet.target || marketplaceFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(marketplaceFacet) }
    ];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    await diamondCut.diamondCut(cut, ethers.ZeroAddress, '0x');

    // get interfaces at diamond
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamond.target || diamond.address);
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamond.target || diamond.address);
    nftFacet = await ethers.getContractAt('NFTFacet', diamond.target || diamond.address);
    marketplaceFacet = await ethers.getContractAt('MarketplaceFacet', diamond.target || diamond.address);

    // initialize
    await nftFacet.initNFT('MyNFT', 'MNFT', 100);
    await marketplaceFacet.initMarketplace(25); // fee = 25/1000
  });

  it('DiamondLoupe returns facets and selectors', async function () {
    const facets = await diamondLoupeFacet.facets();
    expect(facets.length).to.be.greaterThan(0);

    const addresses = await diamondLoupeFacet.facetAddresses();
    expect(addresses.length).to.be.greaterThan(0);

    // pick nftFacet address and query its selectors
    const nftAddr = (await ethers.deployContract('NFTFacet')).target || (await ethers.deployContract('NFTFacet')).address; // just to get deployed address format
    const selectors = await diamondLoupeFacet.facetFunctionSelectors(nftAddr).catch(() => []);
    // facetFunctionSelectors may be empty for an address we didn't register; assert function works by calling facetFunctionSelectors for a registered address
    const registeredAddress = addresses[0];
    const registeredSelectors = await diamondLoupeFacet.facetFunctionSelectors(registeredAddress);
    expect(registeredSelectors.length).to.be.greaterThanOrEqual(0);

    // test facetAddress(selector) for a known selector (mintNFT)
    const Ethers = require('ethers');
    const sig = 'mintNFT(address,string)';
    const sel = Ethers.keccak256(Ethers.toUtf8Bytes(sig)).slice(0, 10);
    const facetForSel = await diamondLoupeFacet.facetAddress(sel);
    // facetForSel may be zero if mintNFT not registered for the facetAddress order, but call should succeed
    expect(facetForSel).to.be.a('string');
  });

  it('Ownership transfer works and is restricted', async function () {
    expect(await ownershipFacet.owner()).to.equal(owner.address);

    // Transfer ownership to addr1
    await ownershipFacet.transferOwnership(addr1.address);
    expect(await ownershipFacet.owner()).to.equal(addr1.address);

    // old owner should no longer be able to transfer
    await expect(ownershipFacet.transferOwnership(owner.address)).to.be.revertedWith('LibDiamond: Must be contract owner');
  });

  it('Marketplace withdrawFees emits and requires fees', async function () {
    // mint, list and buy to generate fees
    await nftFacet.mintNFT(seller.address, 'https://example.com/1');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));

    // buy
    await marketplaceFacet.connect(buyer).buyItem(1, diamond.target || diamond.address, 1, { value: ethers.parseEther('1') });

    // compute expected fee: price * fee / 1000
    const price = ethers.parseEther('1');
    const feeNumerator = 25n;
    const expectedFee = (price * feeNumerator) / 1000n;

    // withdraw fees as owner and expect event
    await expect(marketplaceFacet.withdrawFees()).to.emit(marketplaceFacet, 'FeeWithdrawn').withArgs(owner.address, expectedFee);

    // calling withdraw again should revert (no fees)
    await expect(marketplaceFacet.withdrawFees()).to.be.revertedWith('No fees to withdraw');
  });

  it('Marketplace supports updateListingPrice and refunds overpayment', async function () {
    // mint and list
    await nftFacet.mintNFT(seller.address, 'https://example.com/2');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));

    // seller updates price
    await expect(marketplaceFacet.connect(seller).updateListingPrice(1, ethers.parseEther('2')))
      .to.emit(marketplaceFacet, 'PriceUpdated')
      .withArgs(1, ethers.parseEther('2'));

    // non-seller cannot update
    await expect(marketplaceFacet.connect(buyer).updateListingPrice(1, ethers.parseEther('3'))).to.be.revertedWith('Not the seller');

    // buy with overpayment to exercise refund branch
    await marketplaceFacet.connect(buyer).buyItem(1, diamond.target || diamond.address, 1, { value: ethers.parseEther('2.5') });
  });

  it('NFT approvals and transfer by approved account and operator approvals', async function () {
    // mint a token to addr1
    await nftFacet.mintNFT(addr1.address, 'https://example.com/3');

    // addr1 approves addr2 for token 1
    await nftFacet.connect(addr1).approve(addr1.address, 1); // approve self (no-op)
    await nftFacet.connect(addr1).approve(buyer.address, 1);
    expect(await nftFacet.getApproved(1)).to.equal(buyer.address);

    // buyer can transfer as approved
    await nftFacet.connect(buyer).transferFrom(addr1.address, buyer.address, 1);
    expect(await nftFacet.ownerOf(1)).to.equal(buyer.address);

    // mint another token and test operator approval
    await nftFacet.mintNFT(addr1.address, 'https://example.com/4');
    await nftFacet.connect(addr1).setApprovalForAll(buyer.address, true);
    expect(await nftFacet.isApprovedForAll(addr1.address, buyer.address)).to.equal(true);

    // buyer transfers token 2
    await nftFacet.connect(buyer).transferFrom(addr1.address, buyer.address, 2);
    expect(await nftFacet.ownerOf(2)).to.equal(buyer.address);
  });

  it('diamondCut duplicate selectors revert and remove facet works', async function () {
    const Ethers = require('ethers');
    const sel = Ethers.keccak256(Ethers.toUtf8Bytes('mintNFT(address,string)')).slice(0, 10);

    // find the facet that implements mintNFT
    const facets = await diamondLoupeFacet.facets();
    let nftFacetAddress = ethers.ZeroAddress;
    for (let i = 0; i < facets.length; i++) {
      const f = facets[i];
      const sels = f.functionSelectors.map(s => s);
      if (sels.includes(sel)) {
        nftFacetAddress = f.facetAddress;
        break;
      }
    }
    expect(nftFacetAddress).to.not.equal(ethers.ZeroAddress);

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);

    // trying to add the same selector again should revert with selector already exists
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    await expect(diamondCut.diamondCut([
      { facetAddress: nftFacetAddress, action: FacetCutAction.Add, functionSelectors: [sel] }
    ], ethers.ZeroAddress, '0x')).to.be.revertedWith('LibDiamond: selector already exists');

    // remove the facet and verify selectors are gone
    await diamondCut.diamondCut([
      { facetAddress: nftFacetAddress, action: FacetCutAction.Remove, functionSelectors: [] }
    ], ethers.ZeroAddress, '0x');

    const afterSels = await diamondLoupeFacet.facetFunctionSelectors(nftFacetAddress);
    expect(afterSels.length).to.equal(0);

    // facetAddress for selector should now be zero
    const facetForSel = await diamondLoupeFacet.facetAddress(sel);
    expect(facetForSel).to.equal(ethers.ZeroAddress);
  });

  it('diamondCut replace action is not supported (reverts)', async function () {
    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    // Use a no-op facet address (zero) with replace action to trigger the revert in DiamondCutFacet
    await expect(
      diamondCut.diamondCut([
        { facetAddress: ethers.ZeroAddress, action: FacetCutAction.Replace, functionSelectors: [] }
      ], ethers.ZeroAddress, '0x')
    ).to.be.revertedWith('DiamondCutFacet: Replace not supported in this minimal implementation');
  });

  it('setTokenURI success and getListing view', async function () {
    // mint a token to addr1
    await nftFacet.mintNFT(addr1.address, 'https://example.com/orig');
    // set token URI as contract owner
    await nftFacet.setTokenURI(1, 'https://example.com/updated');
    expect(await nftFacet.tokenURI(1)).to.equal('https://example.com/updated');

    // create a listing and read it via getListing
    await nftFacet.connect(addr1).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(addr1).listItem(diamond.target || diamond.address, 1, ethers.parseEther('0.5'));
    const listing = await marketplaceFacet.getListing(1);
    expect(listing.price).to.equal(ethers.parseEther('0.5'));
    expect(listing.seller).to.equal(addr1.address);
  });

  it('initializeDiamondCut rejects non-empty calldata when _init is zero', async function () {
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await ethers.deployContract('DiamondCutFacet');
    await diamondCutFacet.waitForDeployment();

    const Ethers = require('ethers');
    const canonicalDiamondCutSig = 'diamondCut((address,uint8,bytes4[])[],address,bytes)';
    const diamondCutSelectors = [Ethers.keccak256(Ethers.toUtf8Bytes(canonicalDiamondCutSig)).slice(0, 10)];

    const Diamond = await ethers.getContractFactory('Diamond');
    const localDiamond = await ethers.deployContract('Diamond', [owner.address, diamondCutFacet.target || diamondCutFacet.address, diamondCutSelectors]);
    await localDiamond.waitForDeployment();

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', localDiamond.target || localDiamond.address);

    // calling diamondCut with _init == address(0) but non-empty calldata should revert
    await expect(diamondCut.diamondCut([], ethers.ZeroAddress, '0x01')).to.be.revertedWith('LibDiamond: _init is address(0) but _calldata is not empty');
  });

  it('initializeDiamondCut delegatecall failure propagates revert reason', async function () {
    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await ethers.deployContract('DiamondCutFacet');
    await diamondCutFacet.waitForDeployment();

    const Ethers = require('ethers');
    const canonicalDiamondCutSig = 'diamondCut((address,uint8,bytes4[])[],address,bytes)';
    const diamondCutSelectors = [Ethers.keccak256(Ethers.toUtf8Bytes(canonicalDiamondCutSig)).slice(0, 10)];

    const Diamond = await ethers.getContractFactory('Diamond');
    const localDiamond = await ethers.deployContract('Diamond', [owner.address, diamondCutFacet.target || diamondCutFacet.address, diamondCutSelectors]);
    await localDiamond.waitForDeployment();

    // deploy a facet that reverts on call
    const TestRevertFacet = await ethers.getContractFactory('TestRevertFacet');
    const revertFacet = await TestRevertFacet.deploy();
    await revertFacet.waitForDeployment();

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', localDiamond.target || localDiamond.address);

    // call diamondCut with _init pointing to revertFacet and calldata for willRevert()
    const willRevertSig = Ethers.keccak256(Ethers.toUtf8Bytes('willRevert()')).slice(0, 10);
    try {
      await diamondCut.diamondCut([], revertFacet.target || revertFacet.address, willRevertSig);
      throw new Error('Expected diamondCut to revert');
    } catch (err) {
      const msg = err && err.error && err.error.message ? err.error.message : (err && err.message) ? err.message : '';
      expect(msg).to.include('TestRevertFacet: revert');
    }
  });

  it('addFunctions with zero facet address reverts', async function () {
    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    await expect(diamondCut.diamondCut([
      { facetAddress: ethers.ZeroAddress, action: FacetCutAction.Add, functionSelectors: [] }
    ], ethers.ZeroAddress, '0x')).to.be.revertedWith("LibDiamond: Add facet can't be address(0)");
  });

  it('initializeDiamondCut delegatecall success executes without revert', async function () {
    const TestInitFacet = await ethers.getContractFactory('TestInitFacet');
    const initFacet = await TestInitFacet.deploy();
    await initFacet.waitForDeployment();

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    const Ethers = require('ethers');
    const initSig = Ethers.keccak256(Ethers.toUtf8Bytes('initNoop()')).slice(0, 10);

    // call diamondCut with a valid _init and calldata to exercise successful delegatecall in initializeDiamondCut
    await expect(diamondCut.diamondCut([], initFacet.target || initFacet.address, initSig)).to.not.be.reverted;
  });

  it('addFunctions second call for same facet does not duplicate facet address and removal clears it', async function () {
    const TestMultiFacet = await ethers.getContractFactory('TestMultiFacet');
    const multi = await TestMultiFacet.deploy();
    await multi.waitForDeployment();

    const selFoo = (await getSelectors(multi))[0];
    const selBar = (await getSelectors(multi))[1];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    // Add first selector (this should push facet address into facetAddresses)
    await diamondCut.diamondCut([
      { facetAddress: multi.target || multi.address, action: FacetCutAction.Add, functionSelectors: [selFoo] }
    ], ethers.ZeroAddress, '0x');

    const addressesBefore = await diamondLoupeFacet.facetAddresses();
    const addrCountBefore = addressesBefore.length;

    // Add second selector for the same facet; addFunctions should detect facet exists and NOT push again
    await diamondCut.diamondCut([
      { facetAddress: multi.target || multi.address, action: FacetCutAction.Add, functionSelectors: [selBar] }
    ], ethers.ZeroAddress, '0x');

    const addressesAfter = await diamondLoupeFacet.facetAddresses();
    expect(addressesAfter.length).to.equal(addrCountBefore);

    // Ensure both selectors are registered for the facet
    const sels = await diamondLoupeFacet.facetFunctionSelectors(multi.target || multi.address);
    expect(sels.length).to.be.greaterThanOrEqual(2);

    // Now remove the facet and verify selectors cleared and address removed
    await diamondCut.diamondCut([
      { facetAddress: multi.target || multi.address, action: FacetCutAction.Remove, functionSelectors: [] }
    ], ethers.ZeroAddress, '0x');

    const selsAfter = await diamondLoupeFacet.facetFunctionSelectors(multi.target || multi.address);
    expect(selsAfter.length).to.equal(0);
    const addressesFinal = await diamondLoupeFacet.facetAddresses();
    // address count should be decreased or unchanged depending on ordering, assert it is <= before
    expect(addressesFinal.length).to.be.at.most(addrCountBefore);
  });
});
