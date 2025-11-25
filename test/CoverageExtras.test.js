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

describe('CoverageExtras', function () {
  let owner, addr1, addr2, addr3;
  let diamond;
  let diamondLoupeFacet, ownershipFacet, nftFacet;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

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

    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };
    const cut = [
      { facetAddress: diamondLoupeFacet.target || diamondLoupeFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(diamondLoupeFacet) },
      { facetAddress: ownershipFacet.target || ownershipFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(ownershipFacet) },
      { facetAddress: nftFacet.target || nftFacet.address, action: FacetCutAction.Add, functionSelectors: getSelectors(nftFacet) }
    ];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    await diamondCut.diamondCut(cut, ethers.ZeroAddress, '0x');

    // get interfaces at diamond
    diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', diamond.target || diamond.address);
    ownershipFacet = await ethers.getContractAt('OwnershipFacet', diamond.target || diamond.address);
    nftFacet = await ethers.getContractAt('NFTFacet', diamond.target || diamond.address);

    await nftFacet.initNFT('CoverNFT', 'CNFT', 10);
  });

  it('calls TestMultiFacet functions via diamond (executes facet code)', async function () {
    const TestMultiFacet = await ethers.getContractFactory('TestMultiFacet');
    const multi = await TestMultiFacet.deploy();
    await multi.waitForDeployment();

    const selFoo = (await getSelectors(multi))[0];
    const selBar = (await getSelectors(multi))[1];

    const diamondCut = await ethers.getContractAt('DiamondCutFacet', diamond.target || diamond.address);
    const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

    // Add both selectors into diamond
    await diamondCut.diamondCut([
      { facetAddress: multi.target || multi.address, action: FacetCutAction.Add, functionSelectors: [selFoo, selBar] }
    ], ethers.ZeroAddress, '0x');

    // Call through diamond using TestMultiFacet ABI
    const multiViaDiamond = await ethers.getContractAt('TestMultiFacet', diamond.target || diamond.address);
    expect(await multiViaDiamond.foo()).to.equal('foo');
    expect(await multiViaDiamond.bar()).to.equal('bar');

    // Remove facet and ensure calls revert (selector not found)
    await diamondCut.diamondCut([
      { facetAddress: multi.target || multi.address, action: FacetCutAction.Remove, functionSelectors: [] }
    ], ethers.ZeroAddress, '0x');

    await expect(multiViaDiamond.foo()).to.be.reverted;
    await expect(multiViaDiamond.bar()).to.be.reverted;
  });

  it('exercises remaining NFTFacet branches (approvals clearing, burn by approved, errors)', async function () {
    // mint token 1 to addr1
    await nftFacet.mintNFT(addr1.address, 'https://example.com/1');

    // getApproved should be zero initially
    expect(await nftFacet.getApproved(1)).to.equal(ethers.ZeroAddress);

    // approve addr2 and then transfer by addr2
    await nftFacet.connect(addr1).approve(addr2.address, 1);
    expect(await nftFacet.getApproved(1)).to.equal(addr2.address);

    // addr2 transfers token 1 to addr3
    await nftFacet.connect(addr2).transferFrom(addr1.address, addr3.address, 1);
    expect(await nftFacet.ownerOf(1)).to.equal(addr3.address);

    // approval should have been cleared
    expect(await nftFacet.getApproved(1)).to.equal(ethers.ZeroAddress);

    // mint token 2 and set operator approval
    await nftFacet.mintNFT(addr1.address, 'https://example.com/2');
    await nftFacet.connect(addr1).setApprovalForAll(addr2.address, true);
    expect(await nftFacet.isApprovedForAll(addr1.address, addr2.address)).to.equal(true);

    // addr2 transfers token 2
    await nftFacet.connect(addr2).transferFrom(addr1.address, addr2.address, 2);
    expect(await nftFacet.ownerOf(2)).to.equal(addr2.address);

    // safeTransferFrom path (calls same internal function)
    await nftFacet.mintNFT(addr1.address, 'https://example.com/3');
    await nftFacet.connect(addr1).approve(addr2.address, 3);
    await nftFacet.connect(addr2).safeTransferFrom(addr1.address, addr3.address, 3);
    expect(await nftFacet.ownerOf(3)).to.equal(addr3.address);

    // burn by approved operator
    await nftFacet.mintNFT(addr1.address, 'https://example.com/4');
    await nftFacet.connect(addr1).approve(addr2.address, 4);
    await nftFacet.connect(addr2).burn(4);
    await expect(nftFacet.ownerOf(4)).to.be.revertedWith('ERC721: invalid token ID');

    // setTokenURI success by owner
    await nftFacet.mintNFT(addr1.address, 'https://example.com/5');
    await nftFacet.setTokenURI(5, 'https://example.com/5-updated');
    expect(await nftFacet.tokenURI(5)).to.equal('https://example.com/5-updated');

    // tokenURI for nonexistent token should revert
    await expect(nftFacet.tokenURI(999)).to.be.revertedWith('ERC721Metadata: URI set of nonexistent token');

    // balanceOf zero address revert
    await expect(nftFacet.balanceOf(ethers.ZeroAddress)).to.be.revertedWith('ERC721: address zero is not a valid owner');

    // approve on non-existent token reverts with invalid token id
    await expect(nftFacet.approve(addr2.address, 999)).to.be.revertedWith('ERC721: invalid token ID');

    // transfer with incorrect from should revert
    await nftFacet.mintNFT(addr1.address, 'https://example.com/6');
    await expect(nftFacet.connect(addr2).transferFrom(addr2.address, addr3.address, 6)).to.be.revertedWith('ERC721: transfer from incorrect owner');

    // tokenIds view (cover line that was previously uncovered)
    const ids = await nftFacet.tokenIds();
    expect(ids).to.be.a('bigint');

    // burn by operator approval (setApprovalForAll)
    await nftFacet.mintNFT(addr1.address, 'https://example.com/7');
    await nftFacet.connect(addr1).setApprovalForAll(addr2.address, true);
    await nftFacet.connect(addr2).burn(7);
    await expect(nftFacet.ownerOf(7)).to.be.revertedWith('ERC721: invalid token ID');

    // unauthorized approve should revert (caller is not owner or approved)
    await nftFacet.mintNFT(addr1.address, 'https://example.com/8');
    await expect(nftFacet.connect(addr3).approve(addr2.address, 8)).to.be.revertedWith('ERC721: caller is not token owner or approved');
  });

  it('unauthorized transfer and burn revert to cover negative approval branches', async function () {
    // mint a fresh token and determine its id
    await nftFacet.mintNFT(addr1.address, 'https://example.com/x10');
    const currentId = await nftFacet.tokenIds();
    const tokenId = Number(currentId);

    // addr2 tries to transfer the freshly minted token without approval
    await expect(nftFacet.connect(addr2).transferFrom(addr1.address, addr3.address, tokenId)).to.be.revertedWith('ERC721: caller is not token owner or approved');

    // addr2 tries to burn the freshly minted token without approval
    await expect(nftFacet.connect(addr2).burn(tokenId)).to.be.revertedWith('ERC721: caller is not token owner or approved');
  });

  it('additional NFT branch combinations: operator can approve and owner transfer without approval', async function () {
    // operator approve: owner sets operator, operator calls approve to set token approval for someone else
    await nftFacet.mintNFT(addr1.address, 'https://example.com/op1');
    // addr1 makes addr2 an operator
    await nftFacet.connect(addr1).setApprovalForAll(addr2.address, true);
    // addr2 (operator) approves addr3 for token 1
    await nftFacet.connect(addr2).approve(addr3.address, 1);
    expect(await nftFacet.getApproved(1)).to.equal(addr3.address);

    // owner transfers token without any explicit tokenApproval (approval should be zero for new token)
    await nftFacet.mintNFT(addr1.address, 'https://example.com/op2');
    // ensure token 2 has no approval
    expect(await nftFacet.getApproved(2)).to.equal(ethers.ZeroAddress);
    // owner (addr1) transfers directly
    await nftFacet.connect(addr1).transferFrom(addr1.address, addr2.address, 2);
    expect(await nftFacet.ownerOf(2)).to.equal(addr2.address);
  });

  it('exhaustive transfer/burn combos and setTokenURI nonexistent revert', async function () {
    // token A: owner transfer
    await nftFacet.mintNFT(addr1.address, 'https://example.com/a');
    await nftFacet.connect(addr1).transferFrom(addr1.address, addr2.address, 1);
    expect(await nftFacet.ownerOf(1)).to.equal(addr2.address);

    // token B: token-level approval (addr1 approves addr3), addr3 transfers
    await nftFacet.mintNFT(addr1.address, 'https://example.com/b');
    await nftFacet.connect(addr1).approve(addr3.address, 2);
    await nftFacet.connect(addr3).transferFrom(addr1.address, addr3.address, 2);
    expect(await nftFacet.ownerOf(2)).to.equal(addr3.address);

    // token C: operator approval true and tokenApproval set to someone else; operator should still transfer
    await nftFacet.mintNFT(addr1.address, 'https://example.com/c');
    await nftFacet.connect(addr1).approve(addr3.address, 3);
    await nftFacet.connect(addr1).setApprovalForAll(addr2.address, true);
    await nftFacet.connect(addr2).transferFrom(addr1.address, addr2.address, 3);
    expect(await nftFacet.ownerOf(3)).to.equal(addr2.address);

    // token D: tokenApproval equals operator while operatorApproval false
    await nftFacet.mintNFT(addr1.address, 'https://example.com/d');
    await nftFacet.connect(addr1).approve(addr2.address, 4);
    await nftFacet.connect(addr2).transferFrom(addr1.address, addr3.address, 4);
    expect(await nftFacet.ownerOf(4)).to.equal(addr3.address);

    // setTokenURI by owner on nonexistent token should revert (covers the require branch)
    await expect(nftFacet.setTokenURI(9999, 'https://example.com/x')).to.be.revertedWith('ERC721Metadata: URI set of nonexistent token');
  });

  it('burn by token-approved (not operator) exercises tokenApprovals branch', async function () {
    // mint token to addr1
    await nftFacet.mintNFT(addr1.address, 'https://example.com/token-approve-burn');
    const id = await nftFacet.tokenIds();
    const tokenId = Number(id);

    // ensure no operator approval
    expect(await nftFacet.isApprovedForAll(addr1.address, addr2.address)).to.equal(false);

    // approve addr2 for tokenId
    await nftFacet.connect(addr1).approve(addr2.address, tokenId);

    // addr2 burns the token (token-level approval)
    await nftFacet.connect(addr2).burn(tokenId);

    // ownerOf should now revert
    await expect(nftFacet.ownerOf(tokenId)).to.be.revertedWith('ERC721: invalid token ID');
  });
});
