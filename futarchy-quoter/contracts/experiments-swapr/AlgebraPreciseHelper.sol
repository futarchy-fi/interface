// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/SqrtPriceMath.sol";
import "./libraries/TickMath.sol";

interface IAlgebraPool {
    function globalState() external view returns (uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked);
    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 limitSqrtPrice, bytes calldata data) external returns (int256 amount0, int256 amount1);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract AlgebraPreciseHelper {
    struct QuoteResult {
        int256 amount0;
        int256 amount1;
    }
    
    // Custom error to bubble up the result
    error ReturnedDeltas(int256 amount0, int256 amount1);

    /// @notice Calculates the exact delta to reach a target price by simulating a swap
    /// @param pool The Algebra pool address
    /// @param targetSqrtPriceX96 The target square root price
    function getDeltaToSqrtPrice(
        address pool,
        uint160 targetSqrtPriceX96
    ) external returns (int256 amount0, int256 amount1) {
        (uint160 currentSqrtPriceX96,,,,,,) = IAlgebraPool(pool).globalState();

        if (targetSqrtPriceX96 == currentSqrtPriceX96) return (0, 0);

        bool zeroForOne = targetSqrtPriceX96 < currentSqrtPriceX96;

        try IAlgebraPool(pool).swap(
            address(this),
            zeroForOne,
            type(int256).max, // Exact Input: Infinite amount available
            targetSqrtPriceX96,
            abi.encode(msg.sender) // Pass arbitrary data
        ) {
            // This should not happen if callback works correctly
            revert("Swap finished without reverting");
        } catch (bytes memory reason) {
             return parseRevertReason(reason);
        }
    }

    /// @notice Callback called by the pool during swap
    function algebraSwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata /* data */
    ) external {
        // Revert with the calculated deltas to cancel the state change and return data
        revert ReturnedDeltas(amount0Delta, amount1Delta);
    }

    /// @dev Parses the revert reason to extract the ReturnedDeltas error
    function parseRevertReason(bytes memory reason) internal pure returns (int256, int256) {
        if (reason.length < 4) revert("Invalid revert reason");
        
        // Select selector for error ReturnedDeltas(int256,int256)
        // keccak256("ReturnedDeltas(int256,int256)")
        // selector usually 4 bytes.
        
        // We can just decode assuming it matches our error structure
        // Skip first 4 bytes (selector)
        (int256 a0, int256 a1) = abi.decode(slice(reason, 4, reason.length), (int256, int256));
        return (a0, a1);
    }
    
    // Helper to slice bytes
    function slice(bytes memory data, uint start, uint end) internal pure returns (bytes memory) {
        bytes memory result = new bytes(end - start);
        for(uint i = 0; i < end - start; i++) {
            result[i] = data[i + start];
        }
        return result;
    }
}
