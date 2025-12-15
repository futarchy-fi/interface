// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/math/Math.sol";

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IFutarchyFactory {
    struct ProposalParams {
        string marketName;
        address companyToken;
        address currencyToken;
        string category;
        string language;
        uint256 minBond;
        uint32 openingTime;
    }
    function createProposal(ProposalParams calldata params) external returns (address);
}

interface IFutarchyProposal {
    function wrappedOutcome(uint256 index) external view returns (address, bytes memory);
    function collateralToken1() external view returns (address); // Company Token
    function collateralToken2() external view returns (address); // Currency Token
}

interface IFutarchyAdapter {
    function splitPosition(address proposal, address collateralToken, uint256 amount) external;
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }
    function createAndInitializePoolIfNecessary(address token0, address token1, uint160 sqrtPriceX96) external returns (address pool);
    function mint(MintParams calldata params) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
}

contract FutarchyOrchestrator {
    using Math for uint256;

    IFutarchyFactory public immutable factory;
    IFutarchyAdapter public immutable adapter;
    INonfungiblePositionManager public immutable posManager;

    uint256 constant ONE = 1e18;

    constructor(address _factory, address _adapter, address _posManager) {
        factory = IFutarchyFactory(_factory);
        adapter = IFutarchyAdapter(_adapter);
        posManager = INonfungiblePositionManager(_posManager);
    }

    event PoolCreated(address indexed proposal, uint256 poolId, address pool, uint256 tokenId);

    // --- Core Logic ---

    // POOL 1: YES-Company / YES-Currency
    // Price = Spot * (1 + Impact * (1 - Prob))
    function createProposalAndYesConditionalPool(
        IFutarchyFactory.ProposalParams calldata proposalParams,
        uint256 spotPrice,
        uint256 impact,
        uint256 probability,
        uint256 liquidityAmount
    ) external returns (address proposalAddress, address poolAddress, uint256 tokenId) {
        proposalAddress = factory.createProposal(proposalParams);
        
        (address yesComp, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(0);
        (address yesCurr, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(2);

        // Price Calc
        // impact * (1 - prob)
        uint256 term = (impact * (ONE - probability)) / ONE;
        // spot * (1 + term)
        uint256 targetPrice = (spotPrice * (ONE + term)) / ONE;

        (poolAddress, tokenId) = _orchestratePool(
            proposalAddress,
            yesComp,
            yesCurr,
            targetPrice,
            liquidityAmount,
            proposalParams.companyToken, // Collateral for Token A (YesComp)
            proposalParams.currencyToken // Collateral for Token B (YesCurr)
        );

        emit PoolCreated(proposalAddress, 1, poolAddress, tokenId);
    }

    // POOL 2: NO-Company / NO-Currency
    // Price = Spot * (1 - Impact * Prob)
    function createNoConditionalPool(
        address proposalAddress,
        uint256 spotPrice,
        uint256 impact,
        uint256 probability,
        uint256 liquidityAmount
    ) external returns (address poolAddress, uint256 tokenId) {
        (address noComp, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(1);
        (address noCurr, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(3);

        address compToken = IFutarchyProposal(proposalAddress).collateralToken1();
        address currToken = IFutarchyProposal(proposalAddress).collateralToken2();

        // Price Calc
        // impact * prob
        uint256 term = (impact * probability) / ONE;
        // spot * (1 - term)
        uint256 targetPrice = (spotPrice * (ONE - term)) / ONE;

        (poolAddress, tokenId) = _orchestratePool(
            proposalAddress,
            noComp,
            noCurr,
            targetPrice,
            liquidityAmount,
            compToken,
            currToken
        );
        emit PoolCreated(proposalAddress, 2, poolAddress, tokenId);
    }

    // POOL 3: YES-Company / Currency (sDAI)
    // Price = Spot * Prob
    function createYesExpectedValuePool(
        address proposalAddress,
        uint256 spotPrice,
        uint256 probability,
        uint256 liquidityAmount
    ) external returns (address poolAddress, uint256 tokenId) {
        (address yesComp, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(0);
        address currToken = IFutarchyProposal(proposalAddress).collateralToken2(); // sDAI
        address compToken = IFutarchyProposal(proposalAddress).collateralToken1();

        uint256 targetPrice = (spotPrice * probability) / ONE;

        (poolAddress, tokenId) = _orchestratePool(
            proposalAddress,
            yesComp,
            currToken,
            targetPrice,
            liquidityAmount,
            compToken, // Need to split Comp to get YesComp
            address(0) // No split needed for sDAI, user transfers sDAI directly
        );
        emit PoolCreated(proposalAddress, 3, poolAddress, tokenId);
    }

    // POOL 4: NO-Company / Currency (sDAI)
    // Price = Spot * (1 - Prob)
    function createNoExpectedValuePool(
        address proposalAddress,
        uint256 spotPrice,
        uint256 probability,
        uint256 liquidityAmount
    ) external returns (address poolAddress, uint256 tokenId) {
        (address noComp, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(1);
        address currToken = IFutarchyProposal(proposalAddress).collateralToken2();
        address compToken = IFutarchyProposal(proposalAddress).collateralToken1();

        uint256 targetPrice = (spotPrice * (ONE - probability)) / ONE;

        (poolAddress, tokenId) = _orchestratePool(
            proposalAddress,
            noComp,
            currToken,
            targetPrice,
            liquidityAmount,
            compToken, // Split Comp -> NoComp
            address(0) // No split for sDAI
        );
        emit PoolCreated(proposalAddress, 4, poolAddress, tokenId);
    }

    // POOL 5: YES-Currency / Currency (sDAI)
    // Price = Prob
    function createYesPredictionPool(
        address proposalAddress,
        uint256 probability,
        uint256 liquidityAmount
    ) external returns (address poolAddress, uint256 tokenId) {
        (address yesCurr, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(2);
        address currToken = IFutarchyProposal(proposalAddress).collateralToken2();

        uint256 targetPrice = probability;

        (poolAddress, tokenId) = _orchestratePool(
            proposalAddress,
            yesCurr,
            currToken,
            targetPrice,
            liquidityAmount,
            currToken, // Split Curr -> YesCurr
            address(0) // No split for sDAI
        );
        emit PoolCreated(proposalAddress, 5, poolAddress, tokenId);
    }

    // POOL 6: NO-Currency / Currency (sDAI)
    // Price = 1 - Prob
    function createNoPredictionPool(
        address proposalAddress,
        uint256 probability,
        uint256 liquidityAmount
    ) external returns (address poolAddress, uint256 tokenId) {
        (address noCurr, ) = IFutarchyProposal(proposalAddress).wrappedOutcome(3);
        address currToken = IFutarchyProposal(proposalAddress).collateralToken2();

        uint256 targetPrice = ONE - probability;

        (poolAddress, tokenId) = _orchestratePool(
            proposalAddress,
            noCurr,
            currToken,
            targetPrice,
            liquidityAmount,
            currToken, // Split Curr -> NoCurr
            address(0) // No split for sDAI
        );
        emit PoolCreated(proposalAddress, 6, poolAddress, tokenId);
    }

    // --- Helpers ---

    function _orchestratePool(
        address proposal,
        address tokenA, // Base Token (e.g. YES-Comp)
        address tokenB, // Quote Token (e.g. YES-Curr or sDAI)
        uint256 targetPrice,
        uint256 amountQuote,
        address collateralForA, // If non-zero, split this to get TokenA
        address collateralForB  // If non-zero, split this to get TokenB
    ) internal returns (address pool, uint256 tokenId) {
        // 1. Calculate Amount Base
        // Price = Quote / Base  =>  Base = Quote / Price
        // Scaled: Base = (Quote * 1e18) / Price
        uint256 amountBase = (amountQuote * ONE) / targetPrice;

        // 2. Obtain Token A
        if (collateralForA != address(0)) {
            // Split
            IERC20(collateralForA).transferFrom(msg.sender, address(this), amountBase);
            IERC20(collateralForA).approve(address(adapter), amountBase);
            adapter.splitPosition(proposal, collateralForA, amountBase);
        } else {
            // Direct Transfer (it is likely sDAI)
            // But wait, if TokenA is sDAI, it's just ERC20 transfer
            IERC20(tokenA).transferFrom(msg.sender, address(this), amountBase);
        }

        // 3. Obtain Token B
        if (collateralForB != address(0)) {
            // Split
            IERC20(collateralForB).transferFrom(msg.sender, address(this), amountQuote);
            IERC20(collateralForB).approve(address(adapter), amountQuote);
            adapter.splitPosition(proposal, collateralForB, amountQuote);
        } else {
            // Direct Transfer
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountQuote);
        }

        // 4. Sort and Mint
        address token0;
        address token1;
        uint160 sqrtPriceX96;
        uint256 amount0;
        uint256 amount1;

        if (tokenA < tokenB) {
            token0 = tokenA;
            token1 = tokenB;
            // Standard: Price = Token1/Token0 = Quote/Base = TargetPrice
            sqrtPriceX96 = uint160((Math.sqrt(targetPrice) * (2 ** 96)) / 1e9);
            amount0 = amountBase;
            amount1 = amountQuote;
        } else {
            token0 = tokenB;
            token1 = tokenA;
            // Inverted: Price = Token1/Token0 = Base/Quote = 1/TargetPrice
            // 1e36 / price to keep precision
            uint256 priceInv = (ONE * ONE) / targetPrice;
            sqrtPriceX96 = uint160((Math.sqrt(priceInv) * (2 ** 96)) / 1e9);
            amount0 = amountQuote;
            amount1 = amountBase;
        }

        return _createAndMint(token0, token1, amount0, amount1, sqrtPriceX96);
    }

    function _createAndMint(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1,
        uint160 sqrtPriceX96
    ) internal returns (address pool, uint256 tokenId) {
        IERC20(token0).approve(address(posManager), amount0);
        IERC20(token1).approve(address(posManager), amount1);

        pool = posManager.createAndInitializePoolIfNecessary(token0, token1, sqrtPriceX96);

        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            tickLower: -887220, 
            tickUpper: 887220,
            amount0Desired: amount0,
            amount1Desired: amount1,
            amount0Min: 0,
            amount1Min: 0,
            recipient: msg.sender,
            deadline: block.timestamp + 300
        });

        (tokenId, , , ) = posManager.mint(params);
    }
}
