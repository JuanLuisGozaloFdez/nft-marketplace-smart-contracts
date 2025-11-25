// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestInitFacet {
    event Inited(address caller);

    function initNoop() external {
        emit Inited(msg.sender);
    }
}
