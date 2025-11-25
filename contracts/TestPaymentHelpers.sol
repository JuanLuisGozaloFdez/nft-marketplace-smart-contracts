// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OwnerAccept {
    function callWithdraw(address market) external {
        (bool ok, ) = market.call(abi.encodeWithSignature("withdrawFees()"));
        require(ok, "callWithdraw failed");
    }

    // accept payments
    receive() external payable {}

    fallback() external payable {}
}
