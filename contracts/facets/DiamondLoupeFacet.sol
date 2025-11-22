// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondLoupe} from "../interfaces/IDiamondLoupe.sol";
import {LibDiamond} from "../LibDiamond.sol";

contract DiamondLoupeFacet is IDiamondLoupe {
    function facets() external view returns (Facet[] memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint len = ds.facetAddresses.length;
        Facet[] memory res = new Facet[](len);
        for (uint i = 0; i < len; i++) {
            address facetAddr = ds.facetAddresses[i];
            res[i].facetAddress = facetAddr;
            res[i].functionSelectors = ds.facetFunctionSelectors[facetAddr];
        }
        return res;
    }

    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.facetFunctionSelectors[_facet];
    }

    function facetAddresses() external view returns (address[] memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.facetAddresses;
    }

    function facetAddress(bytes4 _functionSelector) external view returns (address) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.selectorToFacet[_functionSelector];
    }
}
