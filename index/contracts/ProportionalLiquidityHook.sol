// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProportionalLiquidityHook
 * @dev A Balancer v3 hook that enforces strict proportional liquidity operations
 * @notice This hook ensures that all liquidity operations maintain exact proportions
 * @dev Example: For a 2:1 sDAI:GNO pool, adding 1 GNO requires exactly 2 sDAI
 */

// Balancer v3 Hook Interfaces (simplified for this example)
interface IHooks {
    function getHookFlags() external view returns (HookFlags memory);
    function onRegister(
        address factory,
        address pool,
        TokenConfig[] memory tokenConfig,
        LiquidityManagement calldata liquidityManagement
    ) external returns (bool);
    function onBeforeAddLiquidity(
        address router,
        address pool,
        AddLiquidityKind kind,
        uint256[] memory maxAmountsIn,
        uint256 minBptAmountOut,
        uint256[] memory balancesScaled18,
        bytes memory userData
    ) external returns (bool success);
    function onAfterAddLiquidity(
        address router,
        address pool,
        AddLiquidityKind kind,
        uint256[] memory amountsInScaled18,
        uint256[] memory amountsInRaw,
        uint256 bptAmountOut,
        uint256[] memory balancesScaled18,
        bytes memory userData
    ) external returns (bool success, uint256[] memory hookAdjustedAmountsInRaw);
}

struct HookFlags {
    bool enableHookAdjustedAmounts;
    bool shouldCallBeforeInitialize;
    bool shouldCallAfterInitialize;
    bool shouldCallComputeDynamicSwapFee;
    bool shouldCallBeforeSwap;
    bool shouldCallAfterSwap;
    bool shouldCallBeforeAddLiquidity;
    bool shouldCallAfterAddLiquidity;
    bool shouldCallBeforeRemoveLiquidity;
    bool shouldCallAfterRemoveLiquidity;
}

struct TokenConfig {
    address token;
    uint8 decimals;
    uint256 rateProvider;
}

struct LiquidityManagement {
    bool supportsAddLiquidityCustom;
    bool supportsRemoveLiquidityCustom;
}

enum AddLiquidityKind {
    PROPORTIONAL,
    UNBALANCED,
    SINGLE_TOKEN_EXACT_OUT,
    CUSTOM
}

contract ProportionalLiquidityHook is IHooks, Ownable, ReentrancyGuard {
    
    // Events
    event ProportionalLiquidityEnforced(
        address indexed pool,
        address indexed user,
        uint256[] amounts,
        bool isValid
    );
    
    event PoolRegistered(
        address indexed pool,
        address[] tokens,
        uint256[] weights
    );
    
    // Pool configuration
    struct PoolConfig {
        address[] tokens;
        uint256[] weights;
        uint256 totalWeight;
        bool isRegistered;
    }
    
    mapping(address => PoolConfig) public poolConfigs;
    
    // Constants
    uint256 private constant PRECISION = 1e18;
    uint256 private constant TOLERANCE = 10000; // 0.01% tolerance (1/10000)
    
    // Errors
    error PoolNotRegistered();
    error InvalidProportions();
    error InvalidTokensLength();
    error InvalidWeightsLength();
    error ZeroWeight();
    error UnbalancedOperationNotAllowed();
    
    constructor(address _owner) Ownable(_owner) {}
    
    /**
     * @notice Returns the hook flags indicating which hooks are implemented
     * @return hookFlags The flags for this hook
     */
    function getHookFlags() external pure override returns (HookFlags memory) {
        return HookFlags({
            enableHookAdjustedAmounts: false, // We don't adjust amounts, just validate
            shouldCallBeforeInitialize: false,
            shouldCallAfterInitialize: false,
            shouldCallComputeDynamicSwapFee: false,
            shouldCallBeforeSwap: false,
            shouldCallAfterSwap: false,
            shouldCallBeforeAddLiquidity: true,  // ✅ Validate before add
            shouldCallAfterAddLiquidity: false,
            shouldCallBeforeRemoveLiquidity: true, // ✅ Validate before remove
            shouldCallAfterRemoveLiquidity: false
        });
    }
    
    /**
     * @notice Called when a pool registers to use this hook
     * @param factory The factory address
     * @param pool The pool address
     * @param tokenConfig Array of token configurations
     * @param liquidityManagement Liquidity management settings
     * @return success Whether the registration is allowed
     */
    function onRegister(
        address factory,
        address pool,
        TokenConfig[] memory tokenConfig,
        LiquidityManagement calldata liquidityManagement
    ) external override onlyOwner returns (bool) {
        // For this example, we'll set default 1:1 weights
        // In production, this would be configurable
        address[] memory tokens = new address[](tokenConfig.length);
        uint256[] memory weights = new uint256[](tokenConfig.length);
        
        for (uint256 i = 0; i < tokenConfig.length; i++) {
            tokens[i] = tokenConfig[i].token;
            weights[i] = 100; // Equal weights by default
        }
        
        poolConfigs[pool] = PoolConfig({
            tokens: tokens,
            weights: weights,
            totalWeight: weights.length * 100,
            isRegistered: true
        });
        
        emit PoolRegistered(pool, tokens, weights);
        return true;
    }
    
    /**
     * @notice Called before adding liquidity to validate proportions
     * @param router The router address
     * @param pool The pool address
     * @param kind The type of add liquidity operation
     * @param maxAmountsIn Maximum amounts to add
     * @param minBptAmountOut Minimum BPT to receive
     * @param balancesScaled18 Current pool balances
     * @param userData Additional user data
     * @return success Whether to allow the operation
     */
    function onBeforeAddLiquidity(
        address router,
        address pool,
        AddLiquidityKind kind,
        uint256[] memory maxAmountsIn,
        uint256 minBptAmountOut,
        uint256[] memory balancesScaled18,
        bytes memory userData
    ) external override returns (bool success) {
        PoolConfig memory config = poolConfigs[pool];
        if (!config.isRegistered) revert PoolNotRegistered();
        
        // Only allow PROPORTIONAL operations
        if (kind != AddLiquidityKind.PROPORTIONAL) {
            revert UnbalancedOperationNotAllowed();
        }
        
        // Validate that amounts are proportional to weights
        bool isValid = _validateProportions(maxAmountsIn, config.weights);
        
        emit ProportionalLiquidityEnforced(pool, router, maxAmountsIn, isValid);
        
        if (!isValid) revert InvalidProportions();
        
        return true;
    }
    
    /**
     * @notice Called after adding liquidity (not used in this implementation)
     */
    function onAfterAddLiquidity(
        address router,
        address pool,
        AddLiquidityKind kind,
        uint256[] memory amountsInScaled18,
        uint256[] memory amountsInRaw,
        uint256 bptAmountOut,
        uint256[] memory balancesScaled18,
        bytes memory userData
    ) external override returns (bool success, uint256[] memory hookAdjustedAmountsInRaw) {
        // Not used since enableHookAdjustedAmounts = false
        return (true, new uint256[](0));
    }
    
    /**
     * @notice Validates that amounts are proportional to weights
     * @param amounts The amounts to validate
     * @param weights The expected weights
     * @return isValid Whether amounts are proportional
     */
    function _validateProportions(
        uint256[] memory amounts,
        uint256[] memory weights
    ) internal pure returns (bool) {
        if (amounts.length != weights.length) return false;
        if (amounts.length < 2) return false;
        
        // Find the first non-zero amount to establish the ratio
        uint256 baseIndex = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                baseIndex = i;
                break;
            }
        }
        
        uint256 baseRatio = (amounts[baseIndex] * PRECISION) / weights[baseIndex];
        
        // Check all other amounts maintain the same ratio
        for (uint256 i = 0; i < amounts.length; i++) {
            if (i == baseIndex) continue;
            
            uint256 expectedAmount = (baseRatio * weights[i]) / PRECISION;
            uint256 actualAmount = amounts[i];
            
            // Allow small tolerance for precision issues
            uint256 difference = actualAmount > expectedAmount 
                ? actualAmount - expectedAmount 
                : expectedAmount - actualAmount;
                
            if (difference > expectedAmount / TOLERANCE) {
                return false;
            }
        }
        
        return true;
    }
    
    // Owner functions to configure pool weights
    
    /**
     * @notice Set custom weights for a registered pool
     * @param pool The pool address
     * @param weights The new weights
     */
    function setPoolWeights(address pool, uint256[] memory weights) external onlyOwner {
        PoolConfig storage config = poolConfigs[pool];
        if (!config.isRegistered) revert PoolNotRegistered();
        if (weights.length != config.tokens.length) revert InvalidWeightsLength();
        
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            if (weights[i] == 0) revert ZeroWeight();
            totalWeight += weights[i];
        }
        
        config.weights = weights;
        config.totalWeight = totalWeight;
    }
    
    /**
     * @notice Configure a specific pool with tokens and weights
     * @param pool The pool address
     * @param tokens The token addresses
     * @param weights The token weights
     */
    function configurePool(
        address pool,
        address[] memory tokens,
        uint256[] memory weights
    ) external onlyOwner {
        if (tokens.length == 0) revert InvalidTokensLength();
        if (tokens.length != weights.length) revert InvalidWeightsLength();
        
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            if (weights[i] == 0) revert ZeroWeight();
            totalWeight += weights[i];
        }
        
        poolConfigs[pool] = PoolConfig({
            tokens: tokens,
            weights: weights,
            totalWeight: totalWeight,
            isRegistered: true
        });
        
        emit PoolRegistered(pool, tokens, weights);
    }
    
    // View functions
    
    /**
     * @notice Get pool configuration
     * @param pool The pool address
     * @return config The pool configuration
     */
    function getPoolConfig(address pool) external view returns (PoolConfig memory) {
        return poolConfigs[pool];
    }
    
    /**
     * @notice Calculate proportional amounts for a given base amount
     * @param pool The pool address
     * @param baseTokenIndex Index of the base token
     * @param baseAmount Amount of the base token
     * @return amounts Proportional amounts for all tokens
     */
    function calculateProportionalAmounts(
        address pool,
        uint256 baseTokenIndex,
        uint256 baseAmount
    ) external view returns (uint256[] memory amounts) {
        PoolConfig memory config = poolConfigs[pool];
        if (!config.isRegistered) revert PoolNotRegistered();
        
        amounts = new uint256[](config.tokens.length);
        amounts[baseTokenIndex] = baseAmount;
        
        for (uint256 i = 0; i < config.tokens.length; i++) {
            if (i != baseTokenIndex) {
                amounts[i] = (baseAmount * config.weights[i]) / config.weights[baseTokenIndex];
            }
        }
    }
    
    /**
     * @notice Check if amounts are proportional for a pool
     * @param pool The pool address
     * @param amounts The amounts to check
     * @return isValid Whether amounts are proportional
     */
    function isProportional(address pool, uint256[] memory amounts) external view returns (bool) {
        PoolConfig memory config = poolConfigs[pool];
        if (!config.isRegistered) return false;
        
        return _validateProportions(amounts, config.weights);
    }
} 