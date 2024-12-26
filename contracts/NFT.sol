// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MyNFT is ERC721URIStorage, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    mapping(uint256 => bool) private _tokenExists;

    event NFTMinted(uint256 indexed tokenId, address indexed owner, string tokenURI);
    event NFTBurned(uint256 indexed tokenId, address indexed owner);
    event BaseURIChanged(string newBaseURI);
    event TokenURIUpdated(uint256 indexed tokenId, string newTokenURI);

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    function mintNFT(address recipient, string memory tokenURI) public onlyOwner nonReentrant returns (uint256) {
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        
        require(!_tokenExists[newItemId], "Token ID already exists");
        
        _safeMint(recipient, newItemId);
        _setTokenURI(newItemId, tokenURI);
        
        _tokenExists[newItemId] = true;
        
        emit NFTMinted(newItemId, recipient, tokenURI);
        
        return newItemId;
    }

    function burn(uint256 tokenId) public virtual {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: caller is not token owner or approved");
        address owner = ownerOf(tokenId);
        _burn(tokenId);
        _tokenExists[tokenId] = false;
        emit NFTBurned(tokenId, owner);
    }

    function setBaseURI(string memory baseURI) public onlyOwner {
        _setBaseURI(baseURI);
        emit BaseURIChanged(baseURI);
    }

    function updateTokenURI(uint256 tokenId, string memory newTokenURI) public onlyOwner {
        require(_exists(tokenId), "ERC721Metadata: URI set of nonexistent token");
        _setTokenURI(tokenId, newTokenURI);
        emit TokenURIUpdated(tokenId, newTokenURI);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize) internal virtual override {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        require(to != address(0), "ERC721: transfer to the zero address");
    }
}
