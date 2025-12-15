// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/SqrtPriceMath.sol";
import "./libraries/TickMath.sol";

interface IFutarchyProposal {
    function wrappedOutcome(uint256 index) external view returns (address token, bytes memory data);
}

interface IAlgebraFactory {
    function poolByPair(address tokenA, address tokenB) external view returns (address pool);
}

interface IAlgebraPool {
    function globalState() external view returns (uint160 price, int24 tick, uint16 fee, uint16 timepointIndex, uint8 communityFeeToken0, uint8 communityFeeToken1, bool unlocked);
    function swap(address recipient, bool zeroForOne, int256 amountSpecified, uint160 limitSqrtPrice, bytes calldata data) external returns (int256 amount0, int256 amount1);
    function liquidity() external view returns (uint128);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IERC20Metadata {
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

contract FutarchyArbitrageHelper {
    struct PoolInfo {
        address pool;
        address token0;
        address token1;
        string token0Symbol;
        string token1Symbol;
        bool isInverted; // true if Token0 is the CURRENCY
        int256 amount0Delta; // Amount to Add/Remove Token0
        int256 amount1Delta; // Amount to Add/Remove Token1
        uint160 currentSqrtPrice;
        uint160 targetSqrtPrice;
        uint256 targetPriceHuman; // scaled 1e18
    }

    struct ArbitrageResult {
        PoolInfo yesPool;
        PoolInfo noPool;
    }

    struct SwapSimulationResult {
        int256 amount0Delta;
        int256 amount1Delta;
        uint160 startSqrtPrice;
        uint160 endSqrtPrice;
        bytes debugReason;
        bool isToken0Outcome; // New flag for inversion
    }



    // Custom error for simulation
    // Now includes endSqrtPrice
    error ReturnedDeltas(int256 amount0, int256 amount1, uint160 endSqrtPrice);

    address public immutable algebraFactory;

    // 1e18 scale for math
    uint256 constant ONE = 1e18;

    constructor(address _algebraFactory) {
        algebraFactory = _algebraFactory;
    }

    /**
     * @notice Calculate arbitrage amounts for a proposal given parameters.
     * @dev Use staticCall to call this function! It uses the revert trick for simulation.
     */
    function simulateArbitrage(
        address proposal,
        uint256 spotPrice18,       
        uint256 probability18,     
        int256 impact18           
    ) external returns (ArbitrageResult memory result) {
        require(probability18 <= ONE, "Probability > 100%");
        
        (address t0, ) = IFutarchyProposal(proposal).wrappedOutcome(0);
        (address t2, ) = IFutarchyProposal(proposal).wrappedOutcome(2);
        
        (address t1, ) = IFutarchyProposal(proposal).wrappedOutcome(1);
        (address t3, ) = IFutarchyProposal(proposal).wrappedOutcome(3);

        int256 signedOne = int256(ONE);

        // 3. Process YES Pool (Only if prob > 0)
        // If prob == 0, YES event is impossible, price "doesn't matter"
        if (probability18 > 0) {
             // YES Target = Spot * (1 + Impact * (1 - Prob))
             int256 impactTerm = (impact18 * int256(ONE - probability18)) / signedOne;
             int256 factor = signedOne + impactTerm;
             // Ensure factor is positive (price shouldn't go below 0)
             if (factor < 0) factor = 0;
             
             uint256 yesTarget18 = uint256((int256(spotPrice18) * factor) / signedOne);
             result.yesPool = _processPool(t0, t2, yesTarget18);
        }

        // 4. Process NO Pool (Only if prob < 1)
        // If prob == 1, NO event is impossible
        if (probability18 < ONE) {
             // NO Target = Spot * (1 - Impact * Prob)
             int256 noImpactTerm = (impact18 * int256(probability18)) / signedOne;
             int256 factor = signedOne - noImpactTerm;
             if (factor < 0) factor = 0;

             uint256 noTarget18 = uint256((int256(spotPrice18) * factor) / signedOne);
             result.noPool = _processPool(t1, t3, noTarget18);
        }
    }

    function _processPool(address tokenA, address tokenB, uint256 targetPriceHuman18) internal returns (PoolInfo memory info) {
        info.targetPriceHuman = targetPriceHuman18;
        
        // Find Pool
        info.pool = IAlgebraFactory(algebraFactory).poolByPair(tokenA, tokenB);
        
        if (info.pool == address(0)) {
            return info; // Empty pool
        }

        info.token0 = IAlgebraPool(info.pool).token0();
        info.token1 = IAlgebraPool(info.pool).token1();
        
        // Get Symbols
        try IERC20Metadata(info.token0).symbol() returns (string memory s) { info.token0Symbol = s; } catch {}
        try IERC20Metadata(info.token1).symbol() returns (string memory s) { info.token1Symbol = s; } catch {}

        // Determine Inversion
        // Heuristic: If Token0 matches TokenB (which we assume is Currency/Outcome 2), AND TokenA is Asset.
        // Or check symbols? No, let's rely on standard inputs.
        // User said: "wrapped outcome 0 [Asset] and 2 [Currency]".
        // So passed (Asset, Currency).
        // If Token0 == Currency (tokenB), then Inverted.
        if (info.token0 == tokenB) {
            info.isInverted = true;
        } else {
            info.isInverted = false;
        }

        // Calculate Target SqrtPrice
        // Standard Price (T1/T0) = Currency/Asset = Human Price.
        // Inverted Price (T1/T0) = Asset/Currency = 1/Human Price.
        
        uint256 targetPricePool;
        if (info.isInverted) {
             // Target = 1 / Human
             // Scale: 1e36 / Human18 = Result18
             targetPricePool = (ONE * ONE) / targetPriceHuman18; 
        } else {
             targetPricePool = targetPriceHuman18;
        }
        
        uint256 sqrtP = sqrt(targetPricePool); // scale 1e9
        info.targetSqrtPrice = uint160((sqrtP << 96) / 1e9);

        // Get Delta via Simulation
        try this.simulateSwap(info.pool, info.targetSqrtPrice) {
            // Should not happen
        } catch (bytes memory reason) {
             (info.amount0Delta, info.amount1Delta, ) = parseRevertReason(reason);
        }
        
        // Get Current SqrtPrice for reference
        (info.currentSqrtPrice,,,,,,) = IAlgebraPool(info.pool).globalState();
    }

    /**
     * @notice Read-only estimation using active liquidity.
     * @dev Does not simulate swap, so less precise for large moves.
     */
    function estimateArbitrage(
        address proposal,
        uint256 spotPrice18,
        uint256 probability18,
        int256 impact18
    ) external view returns (ArbitrageResult memory result) {
         // Same Target Logic
         (address t0, ) = IFutarchyProposal(proposal).wrappedOutcome(0);
         (address t2, ) = IFutarchyProposal(proposal).wrappedOutcome(2);
         (address t1, ) = IFutarchyProposal(proposal).wrappedOutcome(1);
         (address t3, ) = IFutarchyProposal(proposal).wrappedOutcome(3);

         int256 signedOne = int256(ONE);
         
         if (probability18 > 0) {
             int256 impactTerm = (impact18 * int256(ONE - probability18)) / signedOne;
             int256 factor = signedOne + impactTerm;
             if (factor < 0) factor = 0;
             uint256 yesTarget18 = uint256((int256(spotPrice18) * factor) / signedOne);
             result.yesPool = _estimatePool(t0, t2, yesTarget18);
         }

         if (probability18 < ONE) {
             int256 noImpactTerm = (impact18 * int256(probability18)) / signedOne;
             int256 factor = signedOne - noImpactTerm;
             if (factor < 0) factor = 0;
             uint256 noTarget18 = uint256((int256(spotPrice18) * factor) / signedOne);
             result.noPool = _estimatePool(t1, t3, noTarget18);
         }
    }

    function _estimatePool(address tokenA, address tokenB, uint256 targetPriceHuman18) internal view returns (PoolInfo memory info) {
        info.targetPriceHuman = targetPriceHuman18;
        info.pool = IAlgebraFactory(algebraFactory).poolByPair(tokenA, tokenB);
        if (info.pool == address(0)) return info;

        info.token0 = IAlgebraPool(info.pool).token0();
        info.token1 = IAlgebraPool(info.pool).token1();
        
        // Symbols? Cannot do calls in view easily if they might revert?
        // Actually view can staticcall view.
        // But let's skip strings for estimation to save gas/complexity or assume standard names.
        // Actually we can try.
        try IERC20Metadata(info.token0).symbol() returns (string memory s) { info.token0Symbol = s; } catch {}
        try IERC20Metadata(info.token1).symbol() returns (string memory s) { info.token1Symbol = s; } catch {}

        if (info.token0 == tokenB) info.isInverted = true;
        
        uint256 targetPricePool;
        if (info.isInverted) {
             targetPricePool = (ONE * ONE) / targetPriceHuman18; 
        } else {
             targetPricePool = targetPriceHuman18;
        }
        
        uint256 sqrtP = sqrt(targetPricePool);
        info.targetSqrtPrice = uint160((sqrtP << 96) / 1e9);
        
        

        
        // Math matches Uniswap v3 / Algebra
        // delta0 = L * (sqrtP_tar - sqrtP_cur) / (sqrtP_cur * sqrtP_tar)
        // delta1 = L * (sqrtP_tar - sqrtP_cur)
        // Be careful with signs and ordering.
        
        // We want Amount to ADD to pool to reach Target.
        // If Target < Current: Price Drops. We need to SELL Token0 (Add T0).
        // amount0 > 0.
        // amount0 = L * (1/Target - 1/Current) = L * (Current - Target) / (Current * Target)
        
        // Standard Delta calculation from SqrtPriceMath (simplified here for view)
        // We will just implementing simplified math here to avoid library imports/linking complexity if possible,
        // or just accept it's an estimation.
        
        
        (info.amount0Delta, info.amount1Delta) = _calculateDelta(
            IAlgebraPool(info.pool).liquidity(),
            info.currentSqrtPrice,
            info.targetSqrtPrice
        );
    }

    function _calculateDelta(uint128 L, uint160 spC, uint160 spT) internal pure returns (int256 amount0, int256 amount1) {
        if (spT == spC) return (0, 0);
        
        if (spT < spC) {
             // Down (Target < Current)
             uint256 deltaL = (uint256(L) << 96);
             amount0 = int256(deltaL * (spC - spT) / spC / spT);
             amount1 = -int256(uint256(L) * (spC - spT) >> 96);
        } else {
             // Up (Target > Current)
             uint256 deltaL = (uint256(L) << 96);
             amount0 = -int256(deltaL * (spT - spC) / spT / spC);
             amount1 = int256(uint256(L) * (spT - spC) >> 96);
        }
    }


    // Public simulation function to be called by _processPool via internal transaction or 'this'
    function simulateSwap(address pool, uint160 targetSqrtP) external {
        (uint160 currentSqrtP,,,,,,) = IAlgebraPool(pool).globalState();
        if (targetSqrtP == currentSqrtP) revert ReturnedDeltas(0,0, currentSqrtP);
        
        bool zeroForOne = targetSqrtP < currentSqrtP;
        
        try IAlgebraPool(pool).swap(
            address(this),
            zeroForOne,
            type(int256).max,
            targetSqrtP,
            abi.encode(msg.sender)
        ) {
            revert("Swap failed to revert");
        } catch (bytes memory reason) {
            _handleSwapRevert(reason);
        }
    }

    function simulateQuote(
        address proposal, 
        bool isYesPool, 
        uint8 inputType, 
        uint256 amountIn
    ) external returns (SwapSimulationResult memory) {
        address tokenA;
        address tokenB;
        
        if (isYesPool) {
             (tokenA, ) = IFutarchyProposal(proposal).wrappedOutcome(0); 
             (tokenB, ) = IFutarchyProposal(proposal).wrappedOutcome(2); 
        } else {
             (tokenA, ) = IFutarchyProposal(proposal).wrappedOutcome(1); 
             (tokenB, ) = IFutarchyProposal(proposal).wrappedOutcome(3); 
        }
        
        address pool = IAlgebraFactory(algebraFactory).poolByPair(tokenA, tokenB);
        require(pool != address(0), "Pool not found");
        
        address token0 = IAlgebraPool(pool).token0();
        bool zeroForOne;
        
        address inputToken = (inputType == 0) ? tokenA : tokenB;
        
        if (inputToken == token0) {
            zeroForOne = true;
        } else {
            zeroForOne = false;
        }

        (uint160 currentSqrtP,,,,,,) = IAlgebraPool(pool).globalState();
        uint160 limitSqrtPrice = zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1;

        try IAlgebraPool(pool).swap(
            address(this),
            zeroForOne,
            int256(amountIn),
            limitSqrtPrice,
            abi.encode(msg.sender)
        ) {
             revert("Swap failed to revert");
        } catch (bytes memory reason) {
             (int256 a0, int256 a1, uint160 endP) = parseRevertReason(reason);
             // Check if token0 is outcome (tokenA/tokenB are outcomes?)
             // Yes, tokenA/tokenB are outcomes. 
             // We need to know if token0 is THE outcome we care about?
             // Actually, tokenA/tokenB are the PAIR. One is outcome, one is collateral?
             // No, standard proposal has Outcome/Collateral pairs?
             // Actually, let's just return if token0 == tokenA?
             // In simulateQuote: tokenA is Outcome, tokenB is Collateral (or vice versa depending on setup).
             // Let's assume inputType 0 is "Outcome".
             
             bool isT0Outcome = (token0 == tokenA) && (inputType == 0) || (token0 == tokenB) && (inputType == 1);
             // Simpler: Just pass if token0 equals the 'Asset' token (Outcome 0 or 1).
             // In isYesPool: T0=Outcome(0), T1=Collateral? No, wrappedOutcome(2) is Collateral?
             // Let's rely on the caller knowing what they asked for.
             // Best: Return `token0` address? Or just `isToken0Outcome` based on the proposal lookup.
             
             bool is0Outcome = (token0 == tokenA); // tokenA is always the Outcome(0/1) from wrappedOutcome
             
             return SwapSimulationResult(a0, a1, currentSqrtP, endP, reason, is0Outcome); 
        }
    }

    function simulateExactInput(address pool, bool zeroForOne, int256 amountIn) external returns (SwapSimulationResult memory) {
        (uint160 currentSqrtP,,,,,,) = IAlgebraPool(pool).globalState();
        uint160 limitSqrtPrice = zeroForOne ? TickMath.MIN_SQRT_RATIO + 1 : TickMath.MAX_SQRT_RATIO - 1;

        try IAlgebraPool(pool).swap(
            address(this),
            zeroForOne,
            amountIn,
            limitSqrtPrice,
            abi.encode(msg.sender)
        ) {
             revert("Swap failed to revert");
        } catch (bytes memory reason) {
             (int256 a0, int256 a1, uint160 endP) = parseRevertReason(reason);
             return SwapSimulationResult(a0, a1, currentSqrtP, endP, reason, false); // Unknown for low-level
        }
    }

    function _handleSwapRevert(bytes memory reason) internal pure returns (int256, int256) {
        if (bytes4(reason) == FutarchyArbitrageHelper.ReturnedDeltas.selector) {
             assembly {
                 revert(add(reason, 32), mload(reason))
             }
        } else {
             revert(string(reason));
        }
    }

    function algebraSwapCallback(int256 a0, int256 a1, bytes calldata) external {
        // Fetch the NEW global state. 
        // In Algebra, callback happens after state update but before check.
        (uint160 sqrtPrice,,,,,,) = IAlgebraPool(msg.sender).globalState();
        revert ReturnedDeltas(a0, a1, sqrtPrice);
    }
    
    function parseRevertReason(bytes memory reason) internal pure returns (int256, int256, uint160) {
        // We expect ReturnedDeltas(int256, int256, uint160)
        if (reason.length < 4) return (0,0,0);
        
        if (reason.length >= 100) { // 4 + 32*3 = 100
             return abi.decode(slice(reason, 4, reason.length), (int256, int256, uint160));
        }
        return (0,0,0);
    }

    function slice(bytes memory data, uint start, uint end) internal pure returns (bytes memory) {
        bytes memory result = new bytes(end - start);
        for(uint i = 0; i < end - start; i++) {
            result[i] = data[i + start];
        }
        return result;
    }
    
    // Babylonian method
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
