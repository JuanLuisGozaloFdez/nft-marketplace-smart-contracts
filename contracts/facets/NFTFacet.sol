// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibDiamond} from "../LibDiamond.sol";

library LibNFT {
    bytes32 constant NFT_STORAGE_POSITION = keccak256("diamond.storage.nft");

    struct NFTStorage {
        string name;
        string symbol;
        uint256 tokenIds;
        mapping(uint256 => address) owners;
        mapping(uint256 => string) tokenURIs;
        mapping(address => uint256) balances;
        mapping(address => mapping(address => bool)) operatorApprovals;
        mapping(uint256 => address) tokenApprovals;
        uint256 MAX_SUPPLY;
    }

    function nftStorage() internal pure returns (NFTStorage storage ns) {
        bytes32 position = NFT_STORAGE_POSITION;
        assembly { ns.slot := position }
    }

    function init(string memory _name, string memory _symbol, uint256 _maxSupply) internal {
        NFTStorage storage ns = nftStorage();
        ns.name = _name;
        ns.symbol = _symbol;
        ns.MAX_SUPPLY = _maxSupply;
    }
}

contract NFTFacet {
    event NFTMinted(uint256 indexed tokenId, address indexed owner, string tokenURI);
    event NFTBurned(uint256 indexed tokenId, address indexed owner);

    function initNFT(string memory _name, string memory _symbol, uint256 _maxSupply) external {
        LibDiamond.enforceIsContractOwner();
        LibNFT.init(_name, _symbol, _maxSupply);
    }

    function name() external view returns (string memory) {
        return LibNFT.nftStorage().name;
    }

    function symbol() external view returns (string memory) {
        return LibNFT.nftStorage().symbol;
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = LibNFT.nftStorage().owners[tokenId];
        require(owner != address(0), "ERC721: invalid token ID");
        return owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "ERC721: address zero is not a valid owner");
        return LibNFT.nftStorage().balances[owner];
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(LibNFT.nftStorage().owners[tokenId] != address(0), "ERC721Metadata: URI set of nonexistent token");
        return LibNFT.nftStorage().tokenURIs[tokenId];
    }

    function mintNFT(address recipient, string memory _tokenURI) external returns (uint256) {
        LibDiamond.enforceIsContractOwner();
        LibNFT.NFTStorage storage ns = LibNFT.nftStorage();
        require(ns.tokenIds < ns.MAX_SUPPLY, "Max supply reached");
        ns.tokenIds++;
        uint256 newItemId = ns.tokenIds;
        ns.owners[newItemId] = recipient;
        ns.balances[recipient]++;
        ns.tokenURIs[newItemId] = _tokenURI;
        emit NFTMinted(newItemId, recipient, _tokenURI);
        return newItemId;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        _transferFrom(msg.sender, from, to, tokenId);
    }

    function setApprovalForAll(address operator, bool approved) external {
        LibNFT.NFTStorage storage ns = LibNFT.nftStorage();
        ns.operatorApprovals[msg.sender][operator] = approved;
    }

    function isApprovedForAll(address owner, address operator) external view returns (bool) {
        return LibNFT.nftStorage().operatorApprovals[owner][operator];
    }

    function approve(address to, uint256 tokenId) external {
        LibNFT.NFTStorage storage ns = LibNFT.nftStorage();
        address owner = ns.owners[tokenId];
        require(owner != address(0), "ERC721: invalid token ID");
        require(msg.sender == owner || ns.operatorApprovals[owner][msg.sender], "ERC721: caller is not token owner or approved");
        ns.tokenApprovals[tokenId] = to;
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        return LibNFT.nftStorage().tokenApprovals[tokenId];
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        // Minimal safeTransferFrom: call internal transfer to preserve msg.sender checks
        _transferFrom(msg.sender, from, to, tokenId);
    }

    function _transferFrom(address operator, address from, address to, uint256 tokenId) internal {
        require(to != address(0), "ERC721: transfer to the zero address");
        LibNFT.NFTStorage storage ns = LibNFT.nftStorage();
        address owner = ns.owners[tokenId];
        require(owner == from, "ERC721: transfer from incorrect owner");
        require(operator == owner || ns.operatorApprovals[owner][operator] || ns.tokenApprovals[tokenId] == operator, "ERC721: caller is not token owner or approved");

        // clear approval
        if (ns.tokenApprovals[tokenId] != address(0)) {
            ns.tokenApprovals[tokenId] = address(0);
        }

        ns.owners[tokenId] = to;
        ns.balances[from]--;
        ns.balances[to]++;
    }

    function tokenIds() external view returns (uint256) {
        return LibNFT.nftStorage().tokenIds;
    }

    function setTokenURI(uint256 tokenId, string memory newTokenURI) external {
        LibDiamond.enforceIsContractOwner();
        require(LibNFT.nftStorage().owners[tokenId] != address(0), "ERC721Metadata: URI set of nonexistent token");
        LibNFT.nftStorage().tokenURIs[tokenId] = newTokenURI;
    }

    function burn(uint256 tokenId) external {
        LibNFT.NFTStorage storage ns = LibNFT.nftStorage();
        address owner = ns.owners[tokenId];
        require(owner == msg.sender || ns.operatorApprovals[owner][msg.sender] || ns.tokenApprovals[tokenId] == msg.sender, "ERC721: caller is not token owner or approved");
        delete ns.owners[tokenId];
        delete ns.tokenURIs[tokenId];
        ns.balances[owner]--;
        emit NFTBurned(tokenId, owner);
    }

    function MAX_SUPPLY() external view returns (uint256) {
        return LibNFT.nftStorage().MAX_SUPPLY;
    }
}
