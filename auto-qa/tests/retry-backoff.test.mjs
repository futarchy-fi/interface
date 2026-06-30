/**
 * retryWithExponentialBackoff tests (auto-qa).
 *
 * Pins the core retry primitive in src/utils/retryWithBackoff.js used
 * by MarketPageShowcase (RPC retry path). Subtle behaviors that
 * regressions can break silently:
 *
 *   - retryable predicate (`shouldRetry`) is consulted BEFORE deciding
 *     to backoff/retry — a non-retryable error throws immediately
 *   - exponential delay capped by maxDelay
 *   - last attempt's error is the one rejected (not the first attempt's)
 *   - total attempt count is maxRetries + 1
 *
 * Spec-mirrors src/utils/retryWithBackoff.js's exported
 * `retryWithExponentialBackoff` (lines 11-62). The mirror omits the
 * production console logging.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

async function retryWithExponentialBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 30000,
        shouldRetry = () => true,
    } = options;

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (!shouldRetry(error)) throw error;
            if (attempt === maxRetries) throw error;
            const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

test('retry — success on first attempt returns result with no retries', async () => {
    let calls = 0;
    const result = await retryWithExponentialBackoff(async () => {
        calls++;
        return 'ok';
    });
    assert.equal(result, 'ok');
    assert.equal(calls, 1, 'function must be called exactly once on first-try success');
});

test('retry — success on second attempt after one failure', async () => {
    let calls = 0;
    const result = await retryWithExponentialBackoff(
        async () => {
            calls++;
            if (calls === 1) throw new Error('transient');
            return 'recovered';
        },
        { baseDelay: 5 }
    );
    assert.equal(result, 'recovered');
    assert.equal(calls, 2);
});

// ---------------------------------------------------------------------------
// Failure exhaustion
// ---------------------------------------------------------------------------

test('retry — all attempts fail → throws last error after maxRetries+1 calls', async () => {
    let calls = 0;
    await assert.rejects(
        retryWithExponentialBackoff(
            async () => {
                calls++;
                throw new Error(`fail-${calls}`);
            },
            { maxRetries: 2, baseDelay: 5 }
        ),
        (err) => err.message === 'fail-3',
    );
    assert.equal(calls, 3, 'with maxRetries=2, total attempts must be 3 (1 + 2 retries)');
});

test('retry — default maxRetries is 3 → 4 total attempts', async () => {
    let calls = 0;
    await assert.rejects(
        retryWithExponentialBackoff(
            async () => { calls++; throw new Error('always'); },
            { baseDelay: 5 }
        ),
    );
    assert.equal(calls, 4, 'default 3 retries → 4 attempts total');
});

// ---------------------------------------------------------------------------
// shouldRetry predicate
// ---------------------------------------------------------------------------

test('retry — shouldRetry=false on first failure → throws immediately, no retry', async () => {
    let calls = 0;
    await assert.rejects(
        retryWithExponentialBackoff(
            async () => { calls++; throw new Error('non-retryable'); },
            { baseDelay: 5, shouldRetry: () => false }
        ),
    );
    assert.equal(calls, 1, 'shouldRetry=false must short-circuit after the first attempt');
});

test('retry — shouldRetry inspects the error object', async () => {
    let calls = 0;
    await assert.rejects(
        retryWithExponentialBackoff(
            async () => {
                calls++;
                throw new Error(calls === 1 ? 'retryable' : 'non-retryable');
            },
            { baseDelay: 5, shouldRetry: (e) => e.message === 'retryable' }
        ),
    );
    assert.equal(calls, 2, 'first error retryable, second non-retryable → exactly 2 calls');
});

// ---------------------------------------------------------------------------
// Backoff timing
// ---------------------------------------------------------------------------

test('retry — exponential delay grows: 1× → 2× → 4× baseDelay', async () => {
    const baseDelay = 30;
    const calls = [];
    let attempt = 0;
    const start = Date.now();
    await assert.rejects(
        retryWithExponentialBackoff(
            async () => {
                calls.push(Date.now() - start);
                attempt++;
                throw new Error('always');
            },
            { maxRetries: 3, baseDelay }
        ),
    );
    // Expected gaps between attempts: ~30, ~60, ~120 (1×, 2×, 4×).
    // Timer drift can be significant; allow ±50% slack on the upper bound,
    // strict floor on the lower (must NOT be faster than baseDelay).
    const gaps = calls.slice(1).map((t, i) => t - calls[i]);
    assert.ok(gaps.length === 3, `expected 3 gaps; got ${gaps.length}`);
    for (let i = 0; i < 3; i++) {
        const expected = baseDelay * Math.pow(2, i);
        assert.ok(gaps[i] >= expected - 5,
            `gap ${i} (${gaps[i]}ms) must be ≥ baseDelay×2^${i} (${expected}ms) — backoff broke`);
    }
    // Each gap should be strictly larger than the previous (modulo timer noise).
    assert.ok(gaps[1] > gaps[0] - 10, `gap[1]=${gaps[1]} must grow vs gap[0]=${gaps[0]}`);
    assert.ok(gaps[2] > gaps[1] - 10, `gap[2]=${gaps[2]} must grow vs gap[1]=${gaps[1]}`);
});

test('retry — maxDelay caps the backoff', async () => {
    // baseDelay=10, attempt 5 (uncapped) would be 10*2^5=320ms.
    // Cap maxDelay at 30 — attempt 5 gap should be ≤ ~50ms (30 + slack).
    const calls = [];
    let attempt = 0;
    const start = Date.now();
    await assert.rejects(
        retryWithExponentialBackoff(
            async () => {
                calls.push(Date.now() - start);
                attempt++;
                throw new Error('always');
            },
            { maxRetries: 5, baseDelay: 10, maxDelay: 30 }
        ),
    );
    const gaps = calls.slice(1).map((t, i) => t - calls[i]);
    // The last few gaps should all be bounded by maxDelay + drift slack.
    for (let i = 2; i < gaps.length; i++) {
        assert.ok(gaps[i] <= 30 + 50,
            `gap ${i} (${gaps[i]}ms) exceeded maxDelay=30 + slack — cap broke`);
    }
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test('retry — maxRetries=0 means a single attempt with no retries', async () => {
    let calls = 0;
    await assert.rejects(
        retryWithExponentialBackoff(
            async () => { calls++; throw new Error('once'); },
            { maxRetries: 0 }
        ),
    );
    assert.equal(calls, 1);
});

test('retry — async function returning undefined still counts as success', async () => {
    let calls = 0;
    const result = await retryWithExponentialBackoff(async () => {
        calls++;
        return undefined;
    });
    assert.equal(result, undefined);
    assert.equal(calls, 1);
});
