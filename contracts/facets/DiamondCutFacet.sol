// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {LibDiamond} from "../LibDiamond.sol";

contract DiamondCutFacet is IDiamondCut {
    event DiamondCut(FacetCut[] _cut, address _init, bytes _calldata);

    function diamondCut(FacetCut[] calldata _cut, address _init, bytes calldata _calldata) external override {
        LibDiamond.enforceIsContractOwner();

        for (uint i = 0; i < _cut.length; i++) {
            FacetCutAction action = _cut[i].action;
            address facetAddress = _cut[i].facetAddress;
            bytes4[] memory selectors = _cut[i].functionSelectors;

            if (action == FacetCutAction.Add) {
                LibDiamond.addFunctions(facetAddress, selectors);
            } else if (action == FacetCutAction.Remove) {
                LibDiamond.removeAllSelectorsOfFacet(facetAddress);
            } else {
                revert("DiamondCutFacet: Replace not supported in this minimal implementation");
            }
        }

        emit DiamondCut(_cut, _init, _calldata);

        LibDiamond.initializeDiamondCut(_init, _calldata);
    }
}
