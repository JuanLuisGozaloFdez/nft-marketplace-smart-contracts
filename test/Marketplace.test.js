const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace", function () {
  let nft;
  let marketplace;
  let owner;
  let seller;
  let buyer;

  function getSelectors(contract) {
    const signatures = Object.keys(contract.interface.functions);
    return signatures.map((sig) => contract.interface.getSighash(sig));
  }

  beforeEach(async function () {
    [owner, seller, buyer] = await ethers.getSigners();

    const DiamondCutFacet = await ethers.getContractFactory('DiamondCutFacet');
    const diamondCutFacet = await DiamondCutFacet.deploy();
    await diamondCutFacet.deployed();

    const diamondCutSelectors = getSelectors(diamondCutFacet);

    const Diamond = await ethers.getContractFactory('Diamond');
    const diamond = await Diamond.deploy(owner.address, diamondCutFacet.address, diamondCutSelectors);
    await diamond.deployed();

    const DiamondLoupeFacet = await ethers.getContractFactory('DiamondLoupeFacet');
    const diamondLoupeFacet = await DiamondLoupeFacet.deploy();
    await diamondLoupeFacet.deployed();

    const OwnershipFacet = await ethers.getContractFactory('OwnershipFacet');
    const ownershipFacet = await OwnershipFacet.deploy();
    await ownershipFacet.deployed();

    const NFTFacet = await ethers.getContractFactory('NFTFacet');
    const nftFacet = await NFTFacet.deploy();
    await nftFacet.deployed();

    const MarketplaceFacet = await ethers.getContractFactory('MarketplaceFacet');
    const marketplaceFacet = await MarketplaceFacet.deploy();
    await marketplaceFacet.deployed();

    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const cut = [
      { facetAddress: diamondLoupeFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(diamondLoupeFacet) },
      { facetAddress: ownershipFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(ownershipFacet) },
      { facetAddress: nftFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(nftFacet) },
      { facetAddress: marketplaceFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(marketplaceFacet) }
    ];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.address);
    await diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x');

    nft = await ethers.getContractAt('NFTFacet', diamond.address);
    marketplace = await ethers.getContractAt('MarketplaceFacet', diamond.address);

    // initialize storage
    await nft.initNFT('MyNFT', 'MNFT', 10000);
    await marketplace.initMarketplace(25);

    // Mint an NFT for the seller
    await nft.mintNFT(seller.address, "https://example.com/token/1");
    // Approve marketplace (diamond address) to manage the NFT
    await nft.connect(seller).setApprovalForAll(diamond.address, true);
  });

  describe("Listing", function () {
    it("Should list an item", async function () {
      await expect(marketplace.connect(seller).listItem(nft.address, 1, ethers.utils.parseEther("1")))
        .to.emit(marketplace, "ItemListed")
        .withArgs(1, nft.address, 1, seller.address, ethers.utils.parseEther("1"));
    });

    it("Should not list if not the owner", async function () {
      await expect(
        marketplace.connect(buyer).listItem(nft.address, 1, ethers.utils.parseEther("1"))
      ).to.be.revertedWith("Not the owner");
    });
  });

  describe("Buying", function () {
    beforeEach(async function () {
      await marketplace.connect(seller).listItem(nft.address, 1, ethers.utils.parseEther("1"));
    });

    it("Should allow buying a listed item", async function () {
      await expect(
        marketplace.connect(buyer).buyItem(1, nft.address, 1, { value: ethers.utils.parseEther("1") })
      )
        .to.emit(marketplace, "ItemSold")
        .withArgs(1, nft.address, 1, seller.address, buyer.address, ethers.utils.parseEther("1"));

      expect(await nft.ownerOf(1)).to.equal(buyer.address);
    });

    it("Should not allow buying with insufficient funds", async function () {
      await expect(
        marketplace.connect(buyer).buyItem(1, nft.address, 1, { value: ethers.utils.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient payment");
    });
  });

  describe("Cancelling", function () {
    beforeEach(async function () {
      await marketplace.connect(seller).listItem(nft.address, 1, ethers.utils.parseEther("1"));
    });

    it("Should allow seller to cancel listing", async function () {
      await expect(marketplace.connect(seller).cancelListing(1, nft.address, 1))
        .to.emit(marketplace, "ItemCanceled")
        .withArgs(1, nft.address, 1, seller.address);
    });

    it("Should not allow non-seller to cancel listing", async function () {
      await expect(marketplace.connect(buyer).cancelListing(1, nft.address, 1)).to.be.revertedWith(
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
