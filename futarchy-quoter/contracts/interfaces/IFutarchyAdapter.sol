// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IFutarchyAdapter {
    function splitPosition(
        address proposal,
        address collateralToken,
        uint256 amount
    ) external;
}
