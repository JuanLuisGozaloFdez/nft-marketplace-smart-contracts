// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestRevertFacet {
    function willRevert() external pure {
        revert("TestRevertFacet: revert");
    }
}
