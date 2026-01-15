
import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";
import { Executor } from "../src/services/Executor";
import { FutarchyCartridge } from "../src/services/cartridges/FutarchyCartridge";

const GNO_RPC = "https://rpc.gnosischain.com"; // Public Gnosis RPC
const MARKET_ADDRESS = "0x7e9Fc0C3d6C1619d4914556ad2dEe6051Ce68418"; // Provided by user

async function main() {
    console.log("--- Starting Executor Pattern Verification ---");

    // 1. Setup Services
    const publicClient = createPublicClient({
        chain: gnosis,
        transport: http(GNO_RPC)
    });

    const services = {
        rpc: publicClient,
        wallet: null, // Read-only for this test
        logger: console
    };

    // 2. Instantiate Executor
    const exec = new Executor(services);

    // 3. Install Cartridge
    // This should trigger the dynamic token discovery
    const cartridge = new FutarchyCartridge(MARKET_ADDRESS);
    await exec.install(cartridge);

    // 4. Run Commands
    const tokens = await exec.run("market.getTokens");
    console.log("\n--- Discovered Tokens ---");
    console.table(tokens);

    // Verify sDAI (COLLATERAL_2) is likely correct (should look like an address)
    if (tokens.COLLATERAL_2 && tokens.COLLATERAL_2.startsWith("0x")) {
        console.log("\n[SUCCESS] Token discovery seems to work!");
    } else {
        console.error("\n[FAILURE] Token discovery failed.");
        process.exit(1);
    }
}

main().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
