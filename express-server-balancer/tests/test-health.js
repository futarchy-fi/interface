/**
 * Test: Server Health Check (with timeout)
 * Run: node tests/test-health.js
 */

const fetch = require('node-fetch');
const AbortController = require('abort-controller');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3456';
const TIMEOUT_MS = 5000;

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        return response;
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            throw new Error(`Timeout after ${timeoutMs}ms`);
        }
        throw err;
    }
}

async function testHealth() {
    console.log('🧪 Testing Balancer Server Health');
    console.log('═'.repeat(50));
    console.log(`   Server: ${SERVER_URL}`);
    console.log(`   Timeout: ${TIMEOUT_MS}ms`);

    try {
        const response = await fetchWithTimeout(`${SERVER_URL}/health`);

        if (!response.ok) {
            console.log(`\n❌ Server responded with status: ${response.status}`);
            return false;
        }

        const data = await response.json();

        console.log(`\n✅ Server is up!`);
        console.log(`   Status: ${data.status}`);
        console.log(`   Uptime: ${Math.round(data.uptime)}s`);

        console.log(`\n📊 Indexed Presets:`);
        for (const [preset, info] of Object.entries(data.presets || {})) {
            console.log(`\n   ${preset}:`);
            console.log(`      Status: ${info.status}`);
            console.log(`      Candles: ${info.candleCount || 0}`);
        }

        return true;
    } catch (err) {
        console.log(`\n❌ Cannot connect to server`);
        console.log(`   Error: ${err.message}`);
        console.log(`\n💡 Make sure the server is running:`);
        console.log(`   cd express-server-balancer && npm start`);
        return false;
    }
}

testHealth().then(ok => process.exit(ok ? 0 : 1));
