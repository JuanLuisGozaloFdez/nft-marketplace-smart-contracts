const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace", function () {
  let nft;
  let marketplace;
  let owner;
  let seller;
  let buyer;

  function getSelectors(contract) {
    const Ethers = require('ethers');
    // Prefer built-in sighash when available (ethers v5/v6 compat)
    try {
      if (contract.interface && typeof contract.interface.getSighash === 'function') {
        return contract.interface.fragments
          .filter((f) => f.type === 'function')
          .map((f) => contract.interface.getSighash(f));
      }
    } catch (e) {}

    // Fallback: compute keccak256 of canonical signature string
    return contract.interface.fragments
      .filter((f) => f.type === 'function')
      .map((f) => {
        const sig = `${f.name}(${f.inputs.map((i) => i.type).join(',')})`;
        return Ethers.keccak256(Ethers.toUtf8Bytes(sig)).slice(0, 10);
      });
  }

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const Ethers = require('ethers');
    const diamondCutFacet = await ethers.deployContract('DiamondCutFacet');
    await diamondCutFacet.waitForDeployment();

    // Deterministically compute canonical selector for diamondCut
    const canonicalDiamondCutSig = 'diamondCut((address,uint8,bytes4[])[],address,bytes)';
    const diamondCutSelectors = [Ethers.keccak256(Ethers.toUtf8Bytes(canonicalDiamondCutSig)).slice(0, 10)];
    const selectorsFromDeployed = getSelectors(diamondCutFacet);

    const diamond = await ethers.deployContract('Diamond', [owner.address, diamondCutFacet.target || diamondCutFacet.address, diamondCutSelectors]);
    await diamond.waitForDeployment();

    const diamondLoupeFacet = await ethers.deployContract('DiamondLoupeFacet');
    await diamondLoupeFacet.waitForDeployment();

    const ownershipFacet = await ethers.deployContract('OwnershipFacet');
    await ownershipFacet.waitForDeployment();

    const nftFacet = await ethers.deployContract('NFTFacet');
    await nftFacet.waitForDeployment();

    const marketplaceFacet = await ethers.deployContract('MarketplaceFacet');
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

    nft = await ethers.getContractAt('NFTFacet', diamond.target || diamond.address);
    marketplace = await ethers.getContractAt('MarketplaceFacet', diamond.target || diamond.address);

    // initialize storage
      await nft.initNFT('MyNFT', 'MNFT', 20);
    await marketplace.initMarketplace(25);

    // Mint an NFT for the seller
    await nft.mintNFT(seller.address, "https://example.com/token/1");
    // Approve marketplace (diamond address) to manage the NFT
    await nft.connect(seller).setApprovalForAll(diamond.target || diamond.address, true);
  });

  describe("Listing", function () {
    it("Should list an item", async function () {
        await expect(marketplace.connect(seller).listItem(nft.target || nft.address, 1, ethers.parseEther("1")))
          .to.emit(marketplace, "ItemListed")
          .withArgs(1, nft.target || nft.address, 1, seller.address, ethers.parseEther("1"));
    });

    it("Should not list if not the owner", async function () {
      await expect(
        marketplace.connect(buyer).listItem(nft.target || nft.address, 1, ethers.parseEther("1"))
      ).to.be.revertedWith("Not the owner");
    });
  });

  describe("Buying", function () {
    beforeEach(async function () {
      await marketplace.connect(seller).listItem(nft.target || nft.address, 1, ethers.parseEther("1"));
    });

    it("Should allow buying a listed item", async function () {
      await expect(
          marketplace.connect(buyer).buyItem(1, nft.target || nft.address, 1, { value: ethers.parseEther("1") })
      )
        .to.emit(marketplace, "ItemSold")
          .withArgs(1, nft.target || nft.address, 1, seller.address, buyer.address, ethers.parseEther("1"));

      expect(await nft.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should not allow buying with insufficient funds", async function () {
      await expect(
        marketplace.connect(buyer).buyItem(1, nft.target || nft.address, 1, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient payment");
    });
  });

  describe("Cancelling", function () {
    beforeEach(async function () {
      await marketplace.connect(seller).listItem(nft.target || nft.address, 1, ethers.parseEther("1"));
    });

    it("Should allow seller to cancel listing", async function () {
      await expect(marketplace.connect(seller).cancelListing(1, nft.target || nft.address, 1))
        .to.emit(marketplace, "ItemCanceled")
        .withArgs(1, nft.target || nft.address, 1, seller.address);
    });

    it("Should not allow non-seller to cancel listing", async function () {
      await expect(marketplace.connect(buyer).cancelListing(1, nft.target || nft.address, 1)).to.be.revertedWith(
        "Not the seller"
      );
    });
  });

  describe("Fees", function () {
    it("Should allow owner to update fee", async function () {
      await marketplace.connect(owner).updateFee(50); // 5%
      expect(await marketplace.fee()).to.equal(50);
    });

    it("Should not allow non-owner to update fee", async function () {
      await expect(marketplace.connect(buyer).updateFee(50)).to.be.revertedWith(
        "LibDiamond: Must be contract owner"
      );
    });
  });
});
            "Not the seller"
