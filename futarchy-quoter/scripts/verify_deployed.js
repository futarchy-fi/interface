const hre = require("hardhat");
const { ethers } = hre;
const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

// Target Configuration
const CONTRACT_ADDRESS = "0x6b5b8Ee9097D3e267F60dA1b417C5f8aCa505bf3"; // Target Address
const ARGS = [
    "0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345", // Factory
    "0x7495a583ba85875d59407781b4958ED6e0E1228f", // Adapter
    "0x91fd594c46d8b01e62dbdebed2401dde01817834"  // Position Manager
];
const CHAIN_ID = 100; // Gnosis

async function main() {
    console.log(`\n🕵️ Verifying ${CONTRACT_ADDRESS} via Manual API Script (V2)...`);

    // 1. Read Flat Source
    let sourceCode;
    try {
        // Adjust path if needed, assuming running from root
        const flatPath = path.join(__dirname, '../flat/FutarchyOrchestrator_flat.sol');
        const buffer = fs.readFileSync(flatPath);
        if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
            sourceCode = buffer.toString('utf16le');
        } else {
            sourceCode = buffer.toString('utf8');
        }
    } catch (e) {
        console.error("   ❌ Failed to read flat file:", e.message);
        return;
    }

    // 2. Encode Constructor Args
    const abiCoder = new ethers.AbiCoder();
    const encodedArgs = abiCoder.encode(
         ["address", "address", "address"],
         ARGS
    ).slice(2);

    // 3. Send Request
    const postData = querystring.stringify({
        apikey: process.env.ETHERSCAN_API_KEY,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: CONTRACT_ADDRESS,
        sourceCode: sourceCode,
        codeformat: 'solidity-single-file',
        contractname: 'FutarchyOrchestrator',
        compilerversion: 'v0.8.20+commit.a1b79de6',
        optimizationUsed: 1,
        runs: 200,
        constructorArguements: encodedArgs,
        evmversion: 'paris'
    });

    const options = {
        hostname: 'api.etherscan.io',
        path: `/v2/api?chainid=${CHAIN_ID}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    console.log(`   Sending to https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}...`);

    await new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.status === '1') {
                        console.log(`\n   ✅ Verification Submitted!`);
                        console.log(`   GUID: ${result.result}`);
                        console.log(`   Check status at: https://gnosisscan.io/verifyContract-solc?a=${CONTRACT_ADDRESS}`);
                    } else {
                        console.error(`\n   ❌ Verification Failed: ${result.result}`);
                        console.error(`   Message: ${result.message}`);
                    }
                } catch(e) {
                    console.error("   ❌ Parsing Error", data);
                }
                resolve();
            });
        });
        req.on('error', (e) => {
             console.error(`   ❌ Request Error: ${e.message}`);
             resolve();
        });
        req.write(postData);
        req.end();
    });
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
