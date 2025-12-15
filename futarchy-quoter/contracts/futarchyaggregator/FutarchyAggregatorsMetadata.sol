// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "./FutarchyOrganizationMetadata.sol";

contract FutarchyAggregatorsMetadata is Ownable, Initializable {
    string public aggregatorName;
    string public description;
    FutarchyOrganizationMetadata[] public organizations;

    event AggregatorInfoUpdated(string newName, string newDescription);
    event OrganizationAdded(address indexed organizationMetadata);

    constructor() Ownable(msg.sender) {
        _disableInitializers();
    }

    function initialize(address _owner, string memory _aggregatorName, string memory _description) external initializer {
        _transferOwnership(_owner);
        aggregatorName = _aggregatorName;
        description = _description;
    }

    function updateAggregatorInfo(string memory _newName, string memory _newDescription) external onlyOwner {
        aggregatorName = _newName;
        description = _newDescription;
        emit AggregatorInfoUpdated(_newName, _newDescription);
    }

    function addOrganization(address _organizationMetadata) external onlyOwner {
        organizations.push(FutarchyOrganizationMetadata(_organizationMetadata));
        emit OrganizationAdded(_organizationMetadata);
    }

    function getOrganizationsCount() external view returns (uint256) {
        return organizations.length;
    }

    function getOrganizations(uint256 offset, uint256 limit) external view returns (FutarchyOrganizationMetadata[] memory) {
        uint256 total = organizations.length;
        if (offset >= total) {
            return new FutarchyOrganizationMetadata[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 size = end - offset;
        FutarchyOrganizationMetadata[] memory result = new FutarchyOrganizationMetadata[](size);

        for (uint256 i = 0; i < size; i++) {
            result[i] = organizations[offset + i];
        }

        return result;
    }
}
