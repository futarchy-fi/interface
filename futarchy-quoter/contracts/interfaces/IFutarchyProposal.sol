// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFutarchyProposal {
    function wrappedOutcome(uint256 index) external view returns (address, bytes memory);
    function collateralToken1() external view returns (address);
    function collateralToken2() external view returns (address);
}
