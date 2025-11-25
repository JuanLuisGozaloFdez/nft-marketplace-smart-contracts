// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestMultiFacet {
    function foo() external pure returns (string memory) { return "foo"; }
    function bar() external pure returns (string memory) { return "bar"; }
}
