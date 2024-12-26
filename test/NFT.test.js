const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyNFT", function () {
  let MyNFT;
  let myNFT;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    MyNFT = await ethers.getContractFactory("MyNFT");
    [owner, addr1, addr2] = await ethers.getSigners();
    myNFT = await MyNFT.deploy();
    await myNFT.deployed();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await myNFT.owner()).to.equal(owner.address);
    });

    it("Should have the correct name and symbol", async function () {
      expect(await myNFT.name()).to.equal("MyNFT");
      expect(await myNFT.symbol()).to.equal("MNFT");
    });
  });

  describe("Minting", function () {
    it("Should mint a new token", async function () {
      await expect(myNFT.mintNFT(addr1.address, "https://example.com/token/1"))
        .to.emit(myNFT, "NFTMinted")
        .withArgs(1, addr1.address, "https://example.com/token/1");

      expect(await myNFT.ownerOf(1)).to.equal(addr1.address);
      expect(await myNFT.tokenURI(1)).to.equal("https://example.com/token/1");
    });

    it("Should only allow owner to mint", async function () {
      await expect(
        myNFT.connect(addr1).mintNFT(addr2.address, "https://example.com/token/2")
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await myNFT.mintNFT(addr1.address, "https://example.com/token/1");
    });

    it("Should allow token owner to burn", async function () {
      await myNFT.connect(addr1).burn(1);
      await expect(myNFT.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should not allow non-owner to burn", async function () {
      await expect(myNFT.connect(addr2).burn(1)).to.be.revertedWith(
        "ERC721: caller is not token owner or approved"
      );
    });
  });

  describe("Token transfers", function () {
    beforeEach(async function () {
      await myNFT.mintNFT(addr1.address, "https://example.com/token/1");
    });

    it("Should transfer token between accounts", async function () {
      await myNFT.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      expect(await myNFT.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should fail when transferring to zero address", async function () {
      await expect(
        myNFT.connect(addr1).transferFrom(addr1.address, ethers.constants.AddressZero, 1)
      ).to.be.revertedWith("ERC721: transfer to the zero address");
    });
  });

  it("Should not mint more tokens than the maximum supply", async function () {
    const maxSupply = await myNFT.MAX_SUPPLY();
    for (let i = 0; i < maxSupply; i++) {
      await myNFT.mintNFT(addr1.address, `https://example.com/token/${i}`);
    }
    await expect(myNFT.mintNFT(addr1.address, "https://example.com/token/extra"))
      .to.be.revertedWith("Max supply reached");
  });

  it("Should mint multiple NFTs in a single transaction", async function () {
    const mintBatch = async (count) => {
      const txPromises = [];
      for (let i = 0; i < count; i++) {
        txPromises.push(myNFT.mintNFT(addr1.address, `https://example.com/token/${i}`));
      }
      await Promise.all(txPromises);
    };
    await expect(mintBatch(5)).to.not.be.reverted;
    expect(await myNFT.balanceOf(addr1.address)).to.equal(5);
  });

  it("Should not transfer token to zero address", async function () {
    await myNFT.mintNFT(addr1.address, "https://example.com/token/1");
    await expect(myNFT.connect(addr1).transferFrom(addr1.address, ethers.constants.AddressZero, 1))
      .to.be.revertedWith("ERC721: transfer to the zero address");
  });

  it("Should not burn a non-existent token", async function () {
    await expect(myNFT.burn(999)).to.be.revertedWith("ERC721: invalid token ID");
  });

  it("Should not allow unauthorized address to update token URI", async function () {
    await myNFT.mintNFT(addr1.address, "https://example.com/token/1");
    await expect(myNFT.connect(addr2).setTokenURI(1, "https://example.com/updated"))
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

});