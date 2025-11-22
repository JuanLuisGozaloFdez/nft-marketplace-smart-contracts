// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDiamondLoupe {
    /// These functions are expected to be called frequently by tools.
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    /// @notice Gets all facet addresses and their four byte function selectors.
    function facets() external view returns (Facet[] memory);

    /// @notice Gets all the function selectors supported by a facet.
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory);

    /// @notice Get all the facet addresses used by a diamond.
    function facetAddresses() external view returns (address[] memory);

    /// @notice Gets the facet that supports the given selector.
    function facetAddress(bytes4 _functionSelector) external view returns (address);
}
