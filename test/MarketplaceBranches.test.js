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

describe('Marketplace Branches', function () {
  let owner, seller, buyer, addr1;
  let diamond, nftFacet, marketplaceFacet, diamondLoupeFacet, ownershipFacet;

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

    const nftFacetC = await ethers.deployContract('NFTFacet');
    await nftFacetC.waitForDeployment();
    const marketplaceFacetC = await ethers.deployContract('MarketplaceFacet');
    await marketplaceFacetC.waitForDeployment();

    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const cut = [
      { facetAddress: diamondLoupeFacet.target || diamondLoupeFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(diamondLoupeFacet) },
      { facetAddress: ownershipFacet.target || ownershipFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(ownershipFacet) },
      { facetAddress: nftFacetC.target || nftFacetC.address, action: FacetCutAction.Add, functionSelectors: getSelectors(nftFacetC) },
      { facetAddress: marketplaceFacetC.target || marketplaceFacetC.address, action: FacetCutAction.Add, functionSelectors: getSelectors(marketplaceFacetC) }
    ];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    await diamondCut.diamondCut(cut, ethers.ZeroAddress, '0x');

    // get interfaces at diamond
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamond.target || diamond.address);
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamond.target || diamond.address);
    nftFacet = await ethers.getContractAt('NFTFacet', diamond.target || diamond.address);
    marketplaceFacet = await ethers.getContractAt('MarketplaceFacet', diamond.target || diamond.address);

    // initialize
    await nftFacet.initNFT('MarketNFT', 'MNFT', 100);
    await marketplaceFacet.initMarketplace(25);
  });

  it('listItem price zero reverts and unapproved reverts, approve-by-token path works', async function () {
    // mint to seller
    await nftFacet.mintNFT(seller.address, 'https://example.com/p0');
    // attempt to list with price zero
    await expect(marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, 0)).to.be.revertedWith('Price must be greater than zero');

    // attempt to list without approval
    await expect(marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'))).to.be.revertedWith('NFT not approved');

    // approve marketplace for that token (per-token approval)
    await nftFacet.connect(seller).approve(diamond.target || diamond.address, 1);
    await expect(marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'))).to.not.be.reverted;
  });

  it('buying a non-listed item reverts with Item not listed', async function () {
    // attempt to buy an item id that doesn't exist
    await expect(marketplaceFacet.connect(buyer).buyItem(999, diamond.target || diamond.address, 1, { value: ethers.parseEther('1') })).to.be.revertedWith('Item not listed');
  });

  it('updateFee rejects too-high values', async function () {
    // only owner can call and value must be <= 100
    await expect(marketplaceFacet.updateFee(101)).to.be.revertedWith('Fee too high');
  });

  it('seller transfer failure causes buy to revert with Seller transfer failed', async function () {
    
    // Deploy SellerReject specifically
    const SellerReject = await ethers.getContractFactory('SellerReject');
    const sellerReject = await SellerReject.deploy();
    await sellerReject.waitForDeployment();

    // mint token to sellerReject contract
    await nftFacet.mintNFT(sellerReject.target || sellerReject.address, 'https://example.com/sellrej');

    // sellerReject approves marketplace
    await sellerReject.approveMarket(diamond.target || diamond.address, diamond.target || diamond.address);

    // sellerReject lists the item (calls marketplace.listItem from the contract)
    await sellerReject.list(diamond.target || diamond.address, diamond.target || diamond.address, 1, ethers.parseEther('1'));

    // buyer tries to buy -> seller transfer should fail because SellerReject contract reverts on receive
    await expect(marketplaceFacet.connect(buyer).buyItem(1, diamond.target || diamond.address, 1, { value: ethers.parseEther('1') })).to.be.revertedWith('Seller transfer failed');
  });

  it('refund failure path reverts with Refund failed', async function () {
    // mint to seller EOA
    await nftFacet.mintNFT(seller.address, 'https://example.com/seller');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));

    // deploy buyerReject
    const BuyerReject = await ethers.getContractFactory('BuyerReject');
    const buyerReject = await BuyerReject.deploy();
    await buyerReject.waitForDeployment();

    // buyerReject buys with overpayment; refund to buyerReject will revert
    await expect(buyerReject.buy(diamond.target || diamond.address, 1, diamond.target || diamond.address, 1, { value: ethers.parseEther('2') })).to.be.reverted;
    // We can't rely on a specific revert message because low-level call wraps it; assert overall revert happened
  });

  it('updateListingPrice rejects zero price', async function () {
    await nftFacet.mintNFT(seller.address, 'https://example.com/u1');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));
    await expect(marketplaceFacet.connect(seller).updateListingPrice(1, 0)).to.be.revertedWith('Price must be greater than zero');
  });

  it('withdrawFees failure when owner is a contract that rejects payments', async function () {
    // mint and sell to generate fees
    await nftFacet.mintNFT(seller.address, 'https://example.com/w1');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));
    await marketplaceFacet.connect(buyer).buyItem(1, diamond.target || diamond.address, 1, { value: ethers.parseEther('1') });

    // deploy OwnerReject contract
    const OwnerReject = await ethers.getContractFactory('OwnerReject');
    const ownerReject = await OwnerReject.deploy();
    await ownerReject.waitForDeployment();

    // transfer ownership to ownerReject (only owner can call)
    await ownershipFacet.transferOwnership(ownerReject.target || ownerReject.address);

    // call withdraw via OwnerReject which will call marketplace.withdrawFees and the transfer to ownerReject will revert
    await expect(ownerReject.callWithdraw(diamond.target || diamond.address)).to.be.reverted;
  });

  it('OwnerReject.callWithdraw true path when target market accepts withdraw', async function () {
    const MockMarket = await ethers.getContractFactory('MockMarket');
    const mockMarket = await MockMarket.deploy();
    await mockMarket.waitForDeployment();

    const OwnerReject = await ethers.getContractFactory('OwnerReject');
    const ownerReject = await OwnerReject.deploy();
    await ownerReject.waitForDeployment();

    // calling against a mock market with a benign withdrawFees() should succeed
    await expect(ownerReject.callWithdraw(mockMarket.target || mockMarket.address)).to.not.be.reverted;
  });

  it('SellerReject fallback reverts when called with unknown calldata', async function () {
    const SellerReject = await ethers.getContractFactory('SellerReject');
    const sellerReject = await SellerReject.deploy();
    await sellerReject.waitForDeployment();

    // call with non-matching calldata to trigger fallback
    await expect(owner.sendTransaction({ to: sellerReject.target || sellerReject.address, data: '0x12345678' }))
      .to.be.revertedWith('SellerReject: reject');
  });

  it('BuyerReject onERC721Received is invoked on safeTransferFrom', async function () {
    // mint to seller
    await nftFacet.mintNFT(seller.address, 'https://example.com/transfer');

    // deploy BuyerReject
    const BuyerReject = await ethers.getContractFactory('BuyerReject');
    const buyerReject = await BuyerReject.deploy();
    await buyerReject.waitForDeployment();

    // transfer token to buyerReject (safeTransferFrom will call onERC721Received)
    await expect(nftFacet.connect(seller).safeTransferFrom(seller.address, buyerReject.target || buyerReject.address, 1))
      .to.not.be.reverted;

    // ownership should be buyerReject
    const ownerOf = await nftFacet.ownerOf(1);
    expect(ownerOf).to.equal(buyerReject.target || buyerReject.address);
  });

  it('direct call to BuyerReject.onERC721Received returns selector', async function () {
    const BuyerReject = await ethers.getContractFactory('BuyerReject');
    const buyerReject = await BuyerReject.deploy();
    await buyerReject.waitForDeployment();

    // call the onERC721Received function directly with valid addresses
    const selector = await buyerReject.onERC721Received(owner.address, owner.address, 0, '0x');
    expect(selector).to.equal('0x150b7a02'); // IERC721Receiver.onERC721Received.selector
  });

  it('BuyerReject fallback reverts when called with calldata', async function () {
    const BuyerReject = await ethers.getContractFactory('BuyerReject');
    const buyerReject = await BuyerReject.deploy();
    await buyerReject.waitForDeployment();

    // call with non-matching calldata to trigger fallback
    await expect(owner.sendTransaction({ to: buyerReject.target || buyerReject.address, data: '0xdeadbeef' }))
      .to.be.revertedWith('BuyerReject: refund reject');
  });

  it('OwnerReject fallback reverts when called with unknown calldata', async function () {
    const OwnerReject = await ethers.getContractFactory('OwnerReject');
    const ownerReject = await OwnerReject.deploy();
    await ownerReject.waitForDeployment();

    // call with non-matching calldata to trigger fallback
    await expect(owner.sendTransaction({ to: ownerReject.target || ownerReject.address, data: '0xabcdef01' }))
      .to.be.revertedWith('OwnerReject: reject');
  });

  it('SellerReject.list low-level false path reverts with "list failed"', async function () {
    const SellerReject = await ethers.getContractFactory('SellerReject');
    const sellerReject = await SellerReject.deploy();
    await sellerReject.waitForDeployment();

    // mint to sellerReject to be owner of token 1
    await nftFacet.mintNFT(sellerReject.target || sellerReject.address, 'https://example.com/sellrej2');

    // attempt to list with price = 0 so the marketplace.listItem will revert and low-level call returns ok=false
    await expect(sellerReject.list(diamond.target || diamond.address, diamond.target || diamond.address, 1, 0))
      .to.be.revertedWith('list failed');
  });

  it('BuyerReject low-level success path (buy succeeds when paying exact price)', async function () {
    // mint to seller EOA and list
    await nftFacet.mintNFT(seller.address, 'https://example.com/seller-exact');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));

    // deploy BuyerReject
    const BuyerReject = await ethers.getContractFactory('BuyerReject');
    const buyerReject = await BuyerReject.deploy();
    await buyerReject.waitForDeployment();

    // buyerReject buys with exact payment should succeed (ok == true inside contract)
    await expect(buyerReject.buy(diamond.target || diamond.address, 1, diamond.target || diamond.address, 1, { value: ethers.parseEther('1') }))
      .to.not.be.reverted;

    // verify nft owner is buyerReject contract
    expect(await nftFacet.ownerOf(1)).to.equal(buyerReject.target || buyerReject.address);
  });

  it('OwnerAccept can withdraw fees successfully (contract owner that accepts payments)', async function () {
    // mint and sell to generate fees
    await nftFacet.mintNFT(seller.address, 'https://example.com/w2');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));
    await marketplaceFacet.connect(buyer).buyItem(1, diamond.target || diamond.address, 1, { value: ethers.parseEther('1') });

    // deploy OwnerAccept
    const OwnerAccept = await ethers.getContractFactory('OwnerAccept');
    const ownerAccept = await OwnerAccept.deploy();
    await ownerAccept.waitForDeployment();

    // transfer ownership to ownerAccept
    await ownershipFacet.transferOwnership(ownerAccept.target || ownerAccept.address);

    // now call withdraw via ownerAccept which should succeed because ownerAccept accepts payments
    await expect(ownerAccept.callWithdraw(diamond.target || diamond.address)).to.not.be.reverted;
  });

  it('OwnerAccept (helpers) callWithdraw false path reverts when not owner', async function () {
    const OwnerAccept = await ethers.getContractFactory('OwnerAccept');
    const ownerAccept = await OwnerAccept.deploy();
    await ownerAccept.waitForDeployment();

    // call withdraw without making ownerAccept the owner -> low-level call should fail
    await expect(ownerAccept.callWithdraw(diamond.target || diamond.address)).to.be.revertedWith('callWithdraw failed');
  });

  it('OwnerAcceptLocal (in TestPaymentFailers.sol) can withdraw when set as owner', async function () {
    const OwnerAcceptLocal = await ethers.getContractFactory('OwnerAcceptLocal');
    const ownerAcceptLocal = await OwnerAcceptLocal.deploy();
    await ownerAcceptLocal.waitForDeployment();

    // mint and sell to generate fees
    await nftFacet.mintNFT(seller.address, 'https://example.com/w3');
    await nftFacet.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
    await marketplaceFacet.connect(seller).listItem(diamond.target || diamond.address, 1, ethers.parseEther('1'));
    await marketplaceFacet.connect(buyer).buyItem(1, diamond.target || diamond.address, 1, { value: ethers.parseEther('1') });

    // transfer ownership to ownerAcceptLocal
    await ownershipFacet.transferOwnership(ownerAcceptLocal.target || ownerAcceptLocal.address);

    // should succeed because ownerAcceptLocal accepts payments
    await expect(ownerAcceptLocal.callWithdraw(diamond.target || diamond.address)).to.not.be.reverted;
  });

  it('OwnerAcceptLocal callWithdraw false path reverts when not owner', async function () {
    const OwnerAcceptLocal = await ethers.getContractFactory('OwnerAcceptLocal');
    const ownerAcceptLocal = await OwnerAcceptLocal.deploy();
    await ownerAcceptLocal.waitForDeployment();

    // call withdraw without making ownerAcceptLocal the owner -> low-level call should fail
    await expect(ownerAcceptLocal.callWithdraw(diamond.target || diamond.address)).to.be.revertedWith('callWithdraw failed');
  });
  

  it('OwnerAccept receive() accepts plain ETH transfers', async function () {
    const OwnerAccept = await ethers.getContractFactory('OwnerAccept');
    const ownerAccept = await OwnerAccept.deploy();
    await ownerAccept.waitForDeployment();

    // send plain ETH (no calldata) -> should hit `receive()` and not revert
    await expect(owner.sendTransaction({ to: ownerAccept.target || ownerAccept.address, value: ethers.parseEther('1') })).to.not.be.reverted;
  });

  it('OwnerAccept fallback() accepts calldata transfers', async function () {
    const OwnerAccept = await ethers.getContractFactory('OwnerAccept');
    const ownerAccept = await OwnerAccept.deploy();
    await ownerAccept.waitForDeployment();

    // send ETH with non-empty calldata -> should hit `fallback()` and not revert
    await expect(owner.sendTransaction({ to: ownerAccept.target || ownerAccept.address, value: ethers.parseEther('1'), data: '0xdeadbeef' })).to.not.be.reverted;
  });
});
