// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/Counters.sol";

contract Marketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;

    struct Listing {
        uint256 price;
        address seller;
    }

    Counters.Counter private _itemIds;
    mapping(uint256 => Listing) private _listings;
    uint256 public fee = 25; // 2.5% fee
    uint256 public constant FEE_DENOMINATOR = 1000;

    event ItemListed(uint256 indexed itemId, address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price);
    event ItemSold(uint256 indexed itemId, address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event ItemCanceled(uint256 indexed itemId, address indexed nftContract, uint256 indexed tokenId, address seller);
    event FeeUpdated(uint256 newFee);
    event FeeWithdrawn(address indexed owner, uint256 amount);
    event PriceUpdated(uint256 indexed itemId, uint256 newPrice);

    constructor() Ownable(msg.sender) {}

    function listItem(address nftContract, uint256 tokenId, uint256 price) external nonReentrant {
        require(price > 0, "Price must be greater than zero");
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        require(nft.isApprovedForAll(msg.sender, address(this)), "NFT not approved");

        _itemIds.increment();
        uint256 itemId = _itemIds.current();

        _listings[itemId] = Listing(price, msg.sender);

        emit ItemListed(itemId, nftContract, tokenId, msg.sender, price);
    }

    function buyItem(uint256 itemId, address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = _listings[itemId];
        require(listing.price > 0, "Item not listed");
        require(msg.value >= listing.price, "Insufficient payment");

        delete _listings[itemId];

        uint256 feeAmount = (listing.price * fee) / FEE_DENOMINATOR;
        uint256 sellerAmount = listing.price - feeAmount;

        (bool feeSuccess, ) = payable(owner()).call{value: feeAmount}("");
        require(feeSuccess, "Fee transfer failed");

        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sellerSuccess, "Seller transfer failed");

        IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemSold(itemId, nftContract, tokenId, listing.seller, msg.sender, listing.price);

        if (msg.value > listing.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
            require(refundSuccess, "Refund failed");
        }
    }

    function cancelListing(uint256 itemId, address nftContract, uint256 tokenId) external nonReentrant {
        Listing memory listing = _listings[itemId];
        require(listing.seller == msg.sender, "Not the seller");

        delete _listings[itemId];

        emit ItemCanceled(itemId, nftContract, tokenId, msg.sender);
    }

    function updateFee(uint256 newFee) external onlyOwner {
        require(newFee <= 100, "Fee too high");
        fee = newFee;
        emit FeeUpdated(newFee);
    }

    function updateListingPrice(uint256 itemId, uint256 newPrice) external nonReentrant {
        require(_listings[itemId].seller == msg.sender, "Not the seller");
        require(newPrice > 0, "Price must be greater than zero");
        _listings[itemId].price = newPrice;
        emit PriceUpdated(itemId, newPrice);
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "No fees to withdraw");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
        emit FeeWithdrawn(owner(), amount);
    }

    function getListing(uint256 itemId) external view returns (Listing memory) {
        return _listings[itemId];
    }
}