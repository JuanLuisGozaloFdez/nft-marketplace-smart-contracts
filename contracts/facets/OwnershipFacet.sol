// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibDiamond} from "../LibDiamond.sol";

contract OwnershipFacet {
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function owner() external view returns (address) {
        return LibDiamond.contractOwner();
    }

    function transferOwnership(address _newOwner) external {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
        emit OwnershipTransferred(msg.sender, _newOwner);
    }
}
