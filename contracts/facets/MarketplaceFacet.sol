// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {LibDiamond} from "../LibDiamond.sol";

library LibMarketplace {
    bytes32 constant MARKETPLACE_STORAGE_POSITION = keccak256("diamond.storage.marketplace");

    struct Listing {
        uint256 price;
        address seller;
    }

    struct MarketplaceStorage {
        mapping(uint256 => Listing) listings;
        uint256 itemIds;
        uint256 fee; // fee numerator, denominator fixed to 1000
        uint256 feesCollected; // accumulated fees held in contract until withdrawal
    }

    function marketplaceStorage() internal pure returns (MarketplaceStorage storage ms) {
        bytes32 position = MARKETPLACE_STORAGE_POSITION;
        assembly { ms.slot := position }
    }
}

contract MarketplaceFacet {
    uint256 public constant FEE_DENOMINATOR = 1000;

    event ItemListed(uint256 indexed itemId, address indexed nftContract, uint256 indexed tokenId, address seller, uint256 price);
    event ItemSold(uint256 indexed itemId, address indexed nftContract, uint256 indexed tokenId, address seller, address buyer, uint256 price);
    event ItemCanceled(uint256 indexed itemId, address indexed nftContract, uint256 indexed tokenId, address seller);
    event FeeUpdated(uint256 newFee);
    event FeeWithdrawn(address indexed owner, uint256 amount);
    event PriceUpdated(uint256 indexed itemId, uint256 newPrice);

    function initMarketplace(uint256 _fee) external {
        LibDiamond.enforceIsContractOwner();
        LibMarketplace.marketplaceStorage().fee = _fee;
    }

    function fee() external view returns (uint256) {
        return LibMarketplace.marketplaceStorage().fee;
    }

    function listItem(address nftContract, uint256 tokenId, uint256 price) external {
        require(price > 0, "Price must be greater than zero");
        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not the owner");
        // Allow approval by specific token or operator approval
        bool approvedForAll = nft.isApprovedForAll(msg.sender, address(this));
        address approved = nft.getApproved(tokenId);
        require(approvedForAll || approved == address(this), "NFT not approved");

        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace.marketplaceStorage();
        ms.itemIds++;
        uint256 itemId = ms.itemIds;
        ms.listings[itemId] = LibMarketplace.Listing(price, msg.sender);

        emit ItemListed(itemId, nftContract, tokenId, msg.sender, price);
    }

    function buyItem(uint256 itemId, address nftContract, uint256 tokenId) external payable {
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace.marketplaceStorage();
        LibMarketplace.Listing memory listing = ms.listings[itemId];
        require(listing.price > 0, "Item not listed");
        require(msg.value >= listing.price, "Insufficient payment");
        // Remove listing first to avoid reentrancy on external calls
        delete ms.listings[itemId];

        uint256 feeAmount = (listing.price * ms.fee) / FEE_DENOMINATOR;
        uint256 sellerAmount = listing.price - feeAmount;

        // Accumulate fee in contract balance accounting
        ms.feesCollected += feeAmount;

        // Pay seller
        (bool sellerSuccess, ) = payable(listing.seller).call{value: sellerAmount}("");
        require(sellerSuccess, "Seller transfer failed");

        // Transfer NFT to buyer
        IERC721(nftContract).safeTransferFrom(listing.seller, msg.sender, tokenId);

        emit ItemSold(itemId, nftContract, tokenId, listing.seller, msg.sender, listing.price);

        // Refund overpayment if any
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - listing.price}("");
            require(refundSuccess, "Refund failed");
        }
    }

    function cancelListing(uint256 itemId, address nftContract, uint256 tokenId) external {
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace.marketplaceStorage();
        LibMarketplace.Listing memory listing = ms.listings[itemId];
        require(listing.seller == msg.sender, "Not the seller");

        delete ms.listings[itemId];

        emit ItemCanceled(itemId, nftContract, tokenId, msg.sender);
    }

    function updateFee(uint256 newFee) external {
        LibDiamond.enforceIsContractOwner();
        require(newFee <= 100, "Fee too high");
        LibMarketplace.marketplaceStorage().fee = newFee;
        emit FeeUpdated(newFee);
    }

    function updateListingPrice(uint256 itemId, uint256 newPrice) external {
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace.marketplaceStorage();
        require(ms.listings[itemId].seller == msg.sender, "Not the seller");
        require(newPrice > 0, "Price must be greater than zero");
        ms.listings[itemId].price = newPrice;
        emit PriceUpdated(itemId, newPrice);
    }

    function withdrawFees() external {
        LibDiamond.enforceIsContractOwner();
        LibMarketplace.MarketplaceStorage storage ms = LibMarketplace.marketplaceStorage();
        uint256 amount = ms.feesCollected;
        require(amount > 0, "No fees to withdraw");
        ms.feesCollected = 0;
        (bool success, ) = payable(LibDiamond.contractOwner()).call{value: amount}("");
        require(success, "Withdrawal failed");
        emit FeeWithdrawn(LibDiamond.contractOwner(), amount);
    }

    function getListing(uint256 itemId) external view returns (LibMarketplace.Listing memory) {
        return LibMarketplace.marketplaceStorage().listings[itemId];
    }
}
