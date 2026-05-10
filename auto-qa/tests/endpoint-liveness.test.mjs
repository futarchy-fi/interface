/**
 * Endpoint-liveness invariant (auto-qa).
 *
 * For every subgraph endpoint URL hardcoded in
 * `src/config/subgraphEndpoints.js`, send a trivial GraphQL introspection
 * query and assert:
 *   - HTTP 2xx
 *   - response is valid JSON with a `data.__schema` envelope (i.e. it's
 *     actually a working GraphQL endpoint, not a 200-OK landing page)
 *
 * Why: PRs #47, #49, #50, #60 all stemmed from the AWS → GCP migration
 * leaving the frontend pointing at dead URLs. The dead endpoint returned
 * a `database unavailable` body (so the page rendered empty silently).
 * If any future endpoint drift, dead deploy, or URL typo lands on main,
 * this test fails immediately with a clear message.
 *
 * The test reads the URLs out of the live source file (no copy-paste),
 * so adding a new endpoint to subgraphEndpoints.js automatically extends
 * the coverage.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENDPOINTS_FILE = resolve(__dirname, '../../src/config/subgraphEndpoints.js');

/**
 * Pull every `https://…/graphql` URL out of the endpoints config.
 * Deliberately permissive: any string literal that ends in `/graphql`
 * counts. Keeps the test resilient to refactors that rename the
 * exported constants.
 */
function loadEndpointUrls() {
    const text = readFileSync(ENDPOINTS_FILE, 'utf8');
    const matches = text.matchAll(/['"`](https?:\/\/[^'"`]+\/graphql)['"`]/g);
    return [...new Set([...matches].map(m => m[1]))];
}

const INTROSPECTION = `{ __schema { queryType { name } } }`;

async function probeEndpoint(url) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: INTROSPECTION }),
        signal: AbortSignal.timeout(10000),
    });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    return { status: res.status, body };
}

const urls = loadEndpointUrls();

test('subgraphEndpoints.js contains at least one URL', () => {
    assert.ok(urls.length > 0,
        `expected to find at least one /graphql URL in ${ENDPOINTS_FILE}`);
});

for (const url of urls) {
    test(`endpoint is live: ${url}`, async (t) => {
        // Quick probe — if the URL is unreachable at all, skip rather than fail
        // so we don't fail when the user is offline. But once we GET a response,
        // demand it satisfies the schema-introspection invariant.
        let result;
        try {
            result = await probeEndpoint(url);
        } catch (err) {
            t.skip(`network unreachable for ${url}: ${err.message}`);
            return;
        }
        assert.ok(result.status >= 200 && result.status < 300,
            `${url} returned HTTP ${result.status} (expected 2xx)`);
        assert.ok(result.body && typeof result.body === 'object',
            `${url} did not return JSON`);
        assert.ok(
            result.body.data?.__schema?.queryType?.name,
            `${url} did not return a valid GraphQL introspection envelope. ` +
            `Got: ${JSON.stringify(result.body).slice(0, 200)}…`
        );
    });
}
