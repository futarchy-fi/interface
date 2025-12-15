const { ethers } = require("ethers");

const RPC_URL = "https://gnosis-rpc.publicnode.com";
const TARGET = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418";

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    console.log(`Checking ${TARGET}...`);

    try {
        const c = new ethers.Contract(TARGET, ["function token0() view returns (address)", "function liquidity() view returns (uint128)"], provider);
        const t0 = await c.token0();
        const liq = await c.liquidity();
        console.log("✅ IS POOL");
        console.log("Token0:", t0);
        console.log("Liquidity:", liq.toString());
    } catch (e) {
        console.log("❌ NOT POOL (or call failed):", e.code);
    }

    try {
        const p = new ethers.Contract(TARGET, ["function yesPool() view returns (address)"], provider);
        const yp = await p.yesPool();
        console.log("✅ IS PROPOSAL");
        console.log("YesPool:", yp);
    } catch (e) {
        console.log("❌ NOT PROPOSAL (or call failed):", e.code);
    }
}

main();
