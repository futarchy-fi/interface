// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract FutarchyProposalMetadata is Ownable, Initializable {
    address public proposalAddress;
    string public displayNameQuestion;
    string public displayNameEvent;
    string public description;

    event MetadataUpdated(
        string displayNameQuestion,
        string displayNameEvent,
        string description
    );

    constructor() Ownable(msg.sender) {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _proposalAddress,
        string memory _displayNameQuestion,
        string memory _displayNameEvent,
        string memory _description
    ) external initializer {
        _transferOwnership(_owner);
        proposalAddress = _proposalAddress;
        displayNameQuestion = _displayNameQuestion;
        displayNameEvent = _displayNameEvent;
        description = _description;
    }

    function updateMetadata(
        string memory _displayNameQuestion,
        string memory _displayNameEvent,
        string memory _description
    ) external onlyOwner {
        displayNameQuestion = _displayNameQuestion;
        displayNameEvent = _displayNameEvent;
        description = _description;
        emit MetadataUpdated(_displayNameQuestion, _displayNameEvent, _description);
    }
}
