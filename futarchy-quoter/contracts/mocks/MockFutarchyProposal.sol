// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockFutarchyProposal {
    mapping(uint256 => address) public tokens;

    function setToken(uint256 index, address token) external {
        tokens[index] = token;
    }

    function wrappedOutcome(uint256 index) external view returns (address token, bytes memory data) {
        return (tokens[index], "");
    }
}
