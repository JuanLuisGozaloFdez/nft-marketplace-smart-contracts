const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Marketplace", function () {
  let NFT;
  let nft;
  let Marketplace;
  let marketplace;
  let owner;
  let seller;
  let buyer;

  beforeEach(async function () {
    NFT = await ethers.getContractFactory("MyNFT");
    Marketplace = await ethers.getContractFactory("Marketplace");
    [owner, seller, buyer] = await ethers.getSigners();

    nft = await NFT.deploy();
    await nft.deployed();

    marketplace = await Marketplace.deploy();
    await marketplace.deployed();

    // Mint an NFT for the seller
    await nft.mintNFT(seller.address, "https://example.com/token/1");
    // Approve marketplace to manage the NFT
    await nft.connect(seller).setApprovalForAll(marketplace.address, true);
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
        "Ownable: caller is not the owner"
      );
    });
  });
});
