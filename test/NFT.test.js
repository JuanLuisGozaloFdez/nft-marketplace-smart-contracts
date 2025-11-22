const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MyNFT", function () {
  let nft;
  let ownership;
  let owner;
  let addr1;
  let addr2;

  function getSelectors(contract) {
    const signatures = Object.keys(contract.interface.functions);
    return signatures.map((sig) => contract.interface.getSighash(sig));
  }

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

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

    // cut facets into diamond
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const cut = [
      { facetAddress: diamondLoupeFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(diamondLoupeFacet) },
      { facetAddress: ownershipFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(ownershipFacet) },
      { facetAddress: nftFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(nftFacet) }
    ];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.address);
    await diamondCut.diamondCut(cut, ethers.constants.AddressZero, '0x');

    nft = await ethers.getContractAt('NFTFacet', diamond.address);
    ownership = await ethers.getContractAt('OwnershipFacet', diamond.address);

    // initialize nft storage
    await nft.initNFT('MyNFT', 'MNFT', 10000);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await ownership.owner()).to.equal(owner.address);
    });

    it("Should have the correct name and symbol", async function () {
      expect(await nft.name()).to.equal("MyNFT");
      expect(await nft.symbol()).to.equal("MNFT");
    });
  });

  describe("Minting", function () {
    it("Should mint a new token", async function () {
      await expect(nft.mintNFT(addr1.address, "https://example.com/token/1"))
        .to.emit(nft, "NFTMinted")
        .withArgs(1, addr1.address, "https://example.com/token/1");

      expect(await nft.ownerOf(1)).to.equal(addr1.address);
      expect(await nft.tokenURI(1)).to.equal("https://example.com/token/1");
    });

    it("Should only allow owner to mint", async function () {
      await expect(
        nft.connect(addr1).mintNFT(addr2.address, "https://example.com/token/2")
      ).to.be.revertedWith("LibDiamond: Must be contract owner");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await nft.mintNFT(addr1.address, "https://example.com/token/1");
    });

    it("Should allow token owner to burn", async function () {
      await nft.connect(addr1).burn(1);
      await expect(nft.ownerOf(1)).to.be.revertedWith("ERC721: invalid token ID");
    });

    it("Should not allow non-owner to burn", async function () {
      await expect(nft.connect(addr2).burn(1)).to.be.revertedWith(
        "ERC721: caller is not token owner or approved"
      );
    });
  });

  describe("Token transfers", function () {
    beforeEach(async function () {
      await nft.mintNFT(addr1.address, "https://example.com/token/1");
    });

    it("Should transfer token between accounts", async function () {
      await nft.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
      expect(await nft.ownerOf(1)).to.equal(addr2.address);
    });

    it("Should fail when transferring to zero address", async function () {
      await expect(
        nft.connect(addr1).transferFrom(addr1.address, ethers.constants.AddressZero, 1)
      ).to.be.revertedWith("ERC721: transfer to the zero address");
    });
  });

  it("Should not mint more tokens than the maximum supply", async function () {
    const maxSupply = await nft.MAX_SUPPLY();
    for (let i = 0; i < maxSupply; i++) {
      await nft.mintNFT(addr1.address, `https://example.com/token/${i}`);
    }
    await expect(nft.mintNFT(addr1.address, "https://example.com/token/extra"))
      .to.be.revertedWith("Max supply reached");
  });

  it("Should mint multiple NFTs in a single transaction", async function () {
    const mintBatch = async (count) => {
      const txPromises = [];
      for (let i = 0; i < count; i++) {
        txPromises.push(nft.mintNFT(addr1.address, `https://example.com/token/${i}`));
      }
      await Promise.all(txPromises);
    };
    await expect(mintBatch(5)).to.not.be.reverted;
    expect(await nft.balanceOf(addr1.address)).to.equal(5);
  });

  it("Should not transfer token to zero address", async function () {
    await nft.mintNFT(addr1.address, "https://example.com/token/1");
    await expect(nft.connect(addr1).transferFrom(addr1.address, ethers.constants.AddressZero, 1))
      .to.be.revertedWith("ERC721: transfer to the zero address");
  });

  it("Should not burn a non-existent token", async function () {
    await expect(nft.burn(999)).to.be.revertedWith("ERC721: invalid token ID");
  });

  it("Should not allow unauthorized address to update token URI", async function () {
    await nft.mintNFT(addr1.address, "https://example.com/token/1");
    await expect(nft.connect(addr2).setTokenURI(1, "https://example.com/updated"))
      .to.be.revertedWith("LibDiamond: Must be contract owner");
  });

});