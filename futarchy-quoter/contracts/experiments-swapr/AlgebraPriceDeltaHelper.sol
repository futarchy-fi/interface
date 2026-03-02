// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/*//////////////////////////////////////////////////////////////
                        INTERFACES
//////////////////////////////////////////////////////////////*/

/// @notice Minimal interface for an Algebra-style pool (e.g. Swapr v3 on Gnosis).
interface IAlgebraPool {
    /// @dev Returns global state. We only care about:
    /// - price  = sqrtPriceX96
    /// - tick   = current tick
    /// The rest of the tuple is kept for compatibility.
    function globalState()
        external
        view
        returns (
            uint160 price,
            int24 tick,
            uint16 fee,
            uint16 timepointIndex,
            uint8 communityFeeToken0,
            uint8 communityFeeToken1,
            bool unlocked
        );

    /// @dev Active liquidity at the current tick (sum of all LPs whose range includes the current tick).
    function liquidity() external view returns (uint128);

    function token0() external view returns (address);
    function token1() external view returns (address);
}

/*//////////////////////////////////////////////////////////////
                        LIBRARIES
//////////////////////////////////////////////////////////////*/

import "./libraries/SqrtPriceMath.sol";
import "./libraries/TickMath.sol";

/*//////////////////////////////////////////////////////////////
                    ALGEBRA PRICE DELTA HELPER
//////////////////////////////////////////////////////////////*/

/**
 * @title AlgebraPriceDeltaHelper
 * @notice On-chain helper to estimate how much token0 / token1 needs to move
 *         to go from the current Algebra pool price to a target price.
 */
contract AlgebraPriceDeltaHelper {
    using SqrtPriceMath for uint160;

    /*//////////////////////////////////////////////////////////////
                            PUBLIC VIEWS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Compute signed token amounts required to move from the pool's
     *         current price to a target sqrt price (X96 format).
     *
     * @param pool                 Algebra pool address (e.g. Swapr v3 pool)
     * @param targetSqrtPriceX96   Target sqrt price, same format as pool.globalState().price
     *
     * @return amount0  Signed delta of token0 from the POOL perspective
     * @return amount1  Signed delta of token1 from the POOL perspective
     */
    function getDeltaToSqrtPrice(
        IAlgebraPool pool,
        uint160 targetSqrtPriceX96
    ) public view returns (int256 amount0, int256 amount1) {
        (
            uint160 currentSqrtPriceX96,
            ,
            ,
            ,
            ,
            ,
            /* bool unlocked */
        ) = pool.globalState();

        uint128 L = pool.liquidity();

        require(L > 0, "APDH:NO_LIQUIDITY");
        require(targetSqrtPriceX96 > 0, "APDH:BAD_TARGET");

        // Early exit: already at target (within integer representation)
        if (targetSqrtPriceX96 == currentSqrtPriceX96) {
            return (0, 0);
        }

        // Price goes UP: target > current
        if (targetSqrtPriceX96 > currentSqrtPriceX96) {
            // From A = current to B = target
            uint256 amount0Abs = SqrtPriceMath.getAmount0Delta(
                currentSqrtPriceX96,
                targetSqrtPriceX96,
                L,
                true // roundUp
            );
            uint256 amount1Abs = SqrtPriceMath.getAmount1Delta(
                currentSqrtPriceX96,
                targetSqrtPriceX96,
                L,
                true // roundUp
            );

            // When price goes UP (token1/token0 increases):
            // - The pool LOSES token0
            // - The pool GAINS token1
            amount0 = -int256(amount0Abs);
            amount1 = int256(amount1Abs);

        // Price goes DOWN: target < current
        } else {
            // Reuse same formulas by swapping roles of A/B
            uint256 amount0Abs = SqrtPriceMath.getAmount0Delta(
                targetSqrtPriceX96,
                currentSqrtPriceX96,
                L,
                true
            );
            uint256 amount1Abs = SqrtPriceMath.getAmount1Delta(
                targetSqrtPriceX96,
                currentSqrtPriceX96,
                L,
                true
            );

            // When price goes DOWN (token1/token0 decreases):
            // - The pool GAINS token0
            // - The pool LOSES token1
            amount0 = int256(amount0Abs);
            amount1 = -int256(amount1Abs);
        }
    }

    /**
     * @notice Compute signed token amounts required to move from current
     *         pool price to a target TICK.
     *
     * @dev This is just a convenience wrapper over getDeltaToSqrtPrice.
     *
     * @param pool        Algebra pool address
     * @param targetTick  Desired tick
     *
     * @return amount0  Signed delta of token0 from the POOL perspective
     * @return amount1  Signed delta of token1 from the POOL perspective
     */
    function getDeltaToTick(
        IAlgebraPool pool,
        int24 targetTick
    ) external view returns (int256 amount0, int256 amount1) {
        uint160 targetSqrtPriceX96 = TickMath.getSqrtRatioAtTick(targetTick);
        return getDeltaToSqrtPrice(pool, targetSqrtPriceX96);
    }

    /**
     * @notice Convenience function that additionally returns metadata about
     *         the pool and the direction of the move.
     *
     * @param pool                 Algebra pool address
     * @param targetSqrtPriceX96   Target sqrt price
     *
     * @return token0Addr   Address of token0
     * @return token1Addr   Address of token1
     * @return currentTick  Current pool tick
     * @return amount0      Signed token0 delta (POOL perspective)
     * @return amount1      Signed token1 delta (POOL perspective)
     */
    function describeDeltaToSqrtPrice(
        IAlgebraPool pool,
        uint160 targetSqrtPriceX96
    )
        external
        view
        returns (
            address token0Addr,
            address token1Addr,
            int24 currentTick,
            int256 amount0,
            int256 amount1
        )
    {
        (, currentTick, , , , , ) = pool.globalState();
        (amount0, amount1) = getDeltaToSqrtPrice(pool, targetSqrtPriceX96);

        token0Addr = pool.token0();
        token1Addr = pool.token1();
    }
}
