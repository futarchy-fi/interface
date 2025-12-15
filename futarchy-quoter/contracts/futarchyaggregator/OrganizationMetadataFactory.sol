// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./FutarchyOrganizationMetadata.sol";

contract OrganizationMetadataFactory {
    address public immutable implementation;

    event OrganizationMetadataCreated(address indexed metadata, string name);

    constructor(address _implementation) {
        implementation = _implementation;
    }

    function createOrganizationMetadata(string memory companyName, string memory description) external returns (address) {
        address clone = Clones.clone(implementation);
        FutarchyOrganizationMetadata(clone).initialize(msg.sender, companyName, description);
        emit OrganizationMetadataCreated(clone, companyName);
        return clone;
    }
}
