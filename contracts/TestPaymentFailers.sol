// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IMarketplace {
    function listItem(address nftContract, uint256 tokenId, uint256 price) external;
    function buyItem(uint256 itemId, address nftContract, uint256 tokenId) external payable;
    function withdrawFees() external;
}

contract SellerReject {
    function approveMarket(address nft, address market) external {
        IERC721(nft).setApprovalForAll(market, true);
    }

    function list(address market, address nft, uint256 tokenId, uint256 price) external {
        // call marketplace.listItem as this contract
        (bool ok, ) = market.call(abi.encodeWithSignature("listItem(address,uint256,uint256)", nft, tokenId, price));
        require(ok, "list failed");
    }

    receive() external payable {
        revert("SellerReject: reject");
    }

    fallback() external payable {
        revert("SellerReject: reject");
    }
}

contract BuyerReject is IERC721Receiver {
    function buy(address market, uint256 itemId, address nft, uint256 tokenId) external payable {
        (bool ok, ) = market.call{value: msg.value}(abi.encodeWithSignature("buyItem(uint256,address,uint256)", itemId, nft, tokenId));
        require(ok, "buy failed");
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
        revert("BuyerReject: refund reject");
    }

    fallback() external payable {
        revert("BuyerReject: refund reject");
    }
}

contract OwnerReject {
    function callWithdraw(address market) external {
        (bool ok, ) = market.call(abi.encodeWithSignature("withdrawFees()"));
        require(ok, "callWithdraw failed");
    }

    receive() external payable {
        revert("OwnerReject: reject");
    }

    fallback() external payable {
        revert("OwnerReject: reject");
    }
}

contract OwnerAcceptLocal {
    function callWithdraw(address market) external {
        (bool ok, ) = market.call(abi.encodeWithSignature("withdrawFees()"));
        require(ok, "callWithdraw failed");
    }

    // accept payments
    receive() external payable {}

    fallback() external payable {}
}
