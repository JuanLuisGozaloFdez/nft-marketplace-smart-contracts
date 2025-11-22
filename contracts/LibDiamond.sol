// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IDiamondCut} from "./interfaces/IDiamondCut.sol";

library LibDiamond {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    struct DiamondStorage {
        // function selector => facet address
        mapping(bytes4 => address) selectorToFacet;
        // facet address => function selectors
        mapping(address => bytes4[]) facetFunctionSelectors;
        // list of facet addresses
        address[] facetAddresses;
        // owner
        address contractOwner;
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    function setContractOwner(address _newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        address previousOwner = ds.contractOwner;
        ds.contractOwner = _newOwner;
        emit OwnershipTransferred(previousOwner, _newOwner);
    }

    function contractOwner() internal view returns (address) {
        return diamondStorage().contractOwner;
    }

    function enforceIsContractOwner() internal view {
        require(msg.sender == diamondStorage().contractOwner, "LibDiamond: Must be contract owner");
    }

    function addFunctions(address _facetAddress, bytes4[] memory _selectors) internal {
        DiamondStorage storage ds = diamondStorage();
        require(_facetAddress != address(0), "LibDiamond: Add facet can't be address(0)");

        // add selectors
        for (uint i = 0; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            require(ds.selectorToFacet[selector] == address(0), "LibDiamond: selector already exists");
            ds.selectorToFacet[selector] = _facetAddress;
            ds.facetFunctionSelectors[_facetAddress].push(selector);
        }

        // track facet address if new
        bool exists = false;
        for (uint i = 0; i < ds.facetAddresses.length; i++) {
            if (ds.facetAddresses[i] == _facetAddress) { exists = true; break; }
        }
        if (!exists) ds.facetAddresses.push(_facetAddress);
    }

    function removeAllSelectorsOfFacet(address _facet) internal {
        DiamondStorage storage ds = diamondStorage();
        bytes4[] storage selectors = ds.facetFunctionSelectors[_facet];
        for (uint i = 0; i < selectors.length; i++) {
            bytes4 selector = selectors[i];
            delete ds.selectorToFacet[selector];
        }
        delete ds.facetFunctionSelectors[_facet];
        // remove from facetAddresses
        for (uint i = 0; i < ds.facetAddresses.length; i++) {
            if (ds.facetAddresses[i] == _facet) {
                ds.facetAddresses[i] = ds.facetAddresses[ds.facetAddresses.length - 1];
                ds.facetAddresses.pop();
                break;
            }
        }
    }

    function initializeDiamondCut(address _init, bytes memory _calldata) internal {
        if (_init == address(0)) {
            require(_calldata.length == 0, "LibDiamond: _init is address(0) but _calldata is not empty");
            return;
        }
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        require(success, string(error));
    }
}
