const hre = require("hardhat");
const { ethers } = hre;

async function main() {
    const HELPER_ADDRESS = "0xC0A6d7c4e2d2612D0AeEc7ABd7e3B2C24ddFfB6E";
    const POOL_ADDRESS = "0x51b56a6566EfB1b91371024f7CE063cEC7F23B69";

    // User Params
    const SPOT_PRICE = 107.73;
    const PROBABILITY = 0.6154; // 61.54%
    const IMPACT = 0.0744;      // 7.44%

    console.log(`\n🧪 Testing AlgebraPriceDeltaHelper`);
    console.log(`   Helper: ${HELPER_ADDRESS}`);
    console.log(`   Pool:   ${POOL_ADDRESS}`);
    console.log(`\n📊 Parameters:`);
    console.log(`   Spot Price:  ${SPOT_PRICE}`);
    console.log(`   Probability: ${PROBABILITY * 100}%`);
    console.log(`   Impact:      ${IMPACT * 100}%`);

    // 1. Calculate Target Price (YES Conditional Formula)
    // Price = Spot * (1 + Impact * (1 - Prob))
    // Note: This logic assumes YES Conditional Pool.
    // If it was NO Conditional: Spot * (1 - Impact * Prob)

    // Impact term: impact * (1 - prob)
    const term = IMPACT * (1 - PROBABILITY);

    // Target Price
    // const targetPrice = SPOT_PRICE * (1 + term); 
    // ^ WAIT! Standard Futarchy Formula is often: Spot * (1 + Impact * (1/Prob - 1))? 
    // Let's stick to the FutarchyOrchestrator.sol formula I read earlier:
    // uint256 term = (impact * (ONE - probability)) / ONE;
    // uint256 targetPrice = (spotPrice * (ONE + term)) / ONE;
    // Matches: Spot * (1 + Impact * (1 - Prob))

    const targetPrice = SPOT_PRICE * (1 + term);

    console.log(`\n🎯 Calculated Target Price: ${targetPrice.toFixed(6)}`);

    // 2. Connect to Contracts
    const helper = await ethers.getContractAt("AlgebraPriceDeltaHelper", HELPER_ADDRESS);
    const pool = await ethers.getContractAt("IAlgebraPool", POOL_ADDRESS);

    // 3. Get Pool State to check tokens
    const globalState = await pool.globalState();
    const currentSqrtPriceX96 = globalState.price;
    const currentPrice = (Number(currentSqrtPriceX96) / (2 ** 96)) ** 2;

    const token0 = await pool.token0();
    const token1 = await pool.token1();

    const YES_SDAI = "0x5695F362007fB0Caf01b0D7370deBB30153244eD"; // Currency
    const YES_GNO = "0x536Cd6D315c33E013BCceaea8351f1dC4B4A4a6F"; // Company

    console.log(`\n🏊 Pool State:`);
    console.log(`   Token0: ${token0} ${token0.toLowerCase() === YES_GNO.toLowerCase() ? "(YES GNO / Company)" : ""}`);
    console.log(`   Token1: ${token1} ${token1.toLowerCase() === YES_SDAI.toLowerCase() ? "(YES SDAI / Currency)" : ""}`);

    // If Token0 is Company and Token1 is Currency, Price = Token1/Token0 = Currency per Company.
    // This matches standard "Price of Asset".
    console.log(`   Current Price (Currency per Company): ${currentPrice.toFixed(6)}`);

    // 4. Calculate Target SqrtPriceX96
    // SqrtPrice = sqrt(Price) * 2^96
    // NOTE: This assumes Price = Token1/Token0. 
    // If Token0 is the high-value token (Company) and Token1 is Currency, then Price = Token1/Token0 is correct for "Price in Currency".

    // Let's assume standard ordering where we want Price of Token0 in terms of Token1.
    // If tokens are swapped (Token1 is Company), we might need to invert.
    // For now, we calculate for Target Price as is.

    const targetSqrtPrice = Math.sqrt(targetPrice);
    const targetSqrtPriceX96 = BigInt(Math.floor(targetSqrtPrice * (2 ** 96)));

    console.log(`   Target SqrtPriceX96: ${targetSqrtPriceX96.toString()}`);

    // 5. Call Helper
    console.log(`\n🔮 Calling getDeltaToSqrtPrice...`);
    try {
        const [amount0, amount1] = await helper.getDeltaToSqrtPrice(POOL_ADDRESS, targetSqrtPriceX96);

        console.log(`\n✅ Result:`);
        console.log(`   Amount0 Delta: ${ethers.formatEther(amount0)} (Wei: ${amount0})`);
        console.log(`   Amount1 Delta: ${ethers.formatEther(amount1)} (Wei: ${amount1})`);

        console.log(`\n📝 Interpretation:`);
        if (amount0 < 0) console.log(`   -> Remove ${ethers.formatEther(-amount0)} Token0 from pool (BUY Token0)`);
        else console.log(`   -> Add ${ethers.formatEther(amount0)} Token0 to pool (SELL Token0)`);

        if (amount1 < 0) console.log(`   -> Remove ${ethers.formatEther(-amount1)} Token1 from pool (BUY Token1)`);
        else console.log(`   -> Add ${ethers.formatEther(amount1)} Token1 to pool (SELL Token1)`);


        // 6. Check Fee and Simulate Reverse
        console.log(`\n💰 Checking Fee & Impact...`);
        const fee = globalState.fee; // uint16
        console.log(`   Pool Fee (Zte): ${fee}`);

        // Algebra fee is often in 1e-6? Let's check docs or values.
        // If it's standard V3 style: 500 = 0.05%.
        // Algebra: "The current fee in hundredths of a bip, i.e. 1e-6"
        // So Fee=3000 -> 0.3%. Fee=100 -> 0.01%.
        const feePercent = Number(fee) / 1000000;
        console.log(`   Fee %: ${(feePercent * 100).toFixed(4)}%`);

        const amountIn = ethers.parseEther("0.028723398731805069"); // From previous run
        const amountInEffective = Number(amountIn) * (1 - feePercent);
        const amountInEffectiveWei = BigInt(Math.floor(amountInEffective));

        console.log(`   Simulating Add Token0: ${ethers.formatEther(amountIn)} (Effective: ${ethers.formatEther(amountInEffectiveWei)})`);

        // Logic: NewSqrt = (L * CurrentSqrt) / (L + AmountEff * CurrentSqrt) ?? 
        // Wait, Amount0 = L * (Current - Target) / (Current * Target)
        // Amount0 * Current * Target = L * Current - L * Target
        // Amount0 * Current * Target + L * Target = L * Current
        // Target * (Amount0 * Current + L) = L * Current
        // Target = (L * Current) / (L + Amount0 * Current) <= Wait, units? 
        // Amount0 is standard, L is liquidity units.

        // Let's use the formula from SqrtPriceMath:
        // getNextSqrtPriceFromAmount0RoundingUp
        // numerator1 = liquidity << 96
        // product = amount * sqrtPX96
        // denominator = numerator1 + product
        // price = numerator1 * sqrtPX96 / denominator

        const liquidity = await pool.liquidity();
        console.log(`   Liquidity: ${liquidity}`);

        if (liquidity > 0n) {
            // Javascript BigInt math
            const sh96 = 2n ** 96n;
            const num1 = BigInt(liquidity) * sh96;
            const product = amountInEffectiveWei * BigInt(currentSqrtPriceX96);
            const denom = num1 + product;
            const nextSqrtPriceX96 = (num1 * BigInt(currentSqrtPriceX96)) / denom;

            console.log(`   Next SqrtPriceX96: ${nextSqrtPriceX96}`);
            const nextPrice = (Number(nextSqrtPriceX96) / (2 ** 96)) ** 2;
            console.log(`   Next Price Est: ${nextPrice.toFixed(6)}`);
        } else {
            console.log("   ❌ Liquidity is 0, cannot simulate.");
        }
    } catch (e) {
        console.error("❌ Error calling helper:", e.message);
    }
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
