// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibDiamond} from "./LibDiamond.sol";
import {IDiamondCut} from "./interfaces/IDiamondCut.sol";

contract Diamond {
    constructor(address _contractOwner, address _diamondCutFacet, bytes4[] memory _selectors) {
        LibDiamond.setContractOwner(_contractOwner);
        if (_diamondCutFacet != address(0)) {
            LibDiamond.addFunctions(_diamondCutFacet, _selectors);
        }
    }

    // Find facet for function that is called and delegatecall to it
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        address facet = ds.selectorToFacet[msg.sig];
        require(facet != address(0), "Diamond: Function does not exist");

        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // call facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // retrieve return data
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
