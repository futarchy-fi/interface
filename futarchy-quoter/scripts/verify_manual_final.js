const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
const https = require('https');
const querystring = require('querystring');

// Configuration
const ADDRESS = "0x7F52d79A3C3874379BAa73262F9b76c6e6Ab3764";
const CHAIN_ID = 100;
const ARGS = [
    "0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345", // Factory
    "0x7495a583ba85875d59407781b4958ED6e0E1228f", // Adapter
    "0x91fd594c46d8b01e62dbdebed2401dde01817834"  // Position Manager
];

async function main() {
    console.log(`\n🕵️ Manually Verifying ${ADDRESS}...`);

    // 1. Read Source
    let sourceCode;
    try {
        const flatPath = path.join(__dirname, '../flat/FutarchyOrchestrator_flat.sol');
        const buffer = fs.readFileSync(flatPath);
        if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
            sourceCode = buffer.toString('utf16le');
        } else {
            sourceCode = buffer.toString('utf8');
        }
    } catch (e) {
        console.error("❌ Flat file not found. Run 'npx hardhat flatten ...'");
        return;
    }

    // 2. Encode Args
    const abiCoder = new ethers.AbiCoder();
    const encodedArgs = abiCoder.encode(
        ["address", "address", "address"],
        ARGS
    ).slice(2);

    // 3. Prepare Payload
    const postData = querystring.stringify({
        apikey: process.env.ETHERSCAN_API_KEY,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: ADDRESS,
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

    // 4. Send Request
    console.log(`\n🚀 Sending request to GnosisScan V2 API...`);

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.status === "1") {
                    console.log(`\n✅ Success! GUID: ${json.result}`);
                    console.log(`🔗 https://gnosisscan.io/verifyContract-solc?a=${ADDRESS}`);
                } else {
                    console.log(`\n❌ Failed: ${json.result}`);
                    console.log(`Reason: ${json.message}`);
                }
            } catch (e) {
                console.error("❌ Invalid JSON response:", data);
            }
        });
    });

    req.on('error', e => console.error("❌ Request Error:", e));
    req.write(postData);
    req.end();
}

main();
