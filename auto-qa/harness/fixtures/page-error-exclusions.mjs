/**
 * page-error-exclusions.mjs — slice 124.
 *
 * Shared exclusion lists for the Playwright page-error monitor
 * (scenarios with `assertNoPageErrors: true` opt into it).
 *
 * ── Why a shared module ─────────────────────────────────────────────
 * Slice 80 empirically populated scenario 10's exclusion list (17
 * errors observed; 10 narrowly excluded). Slice 123 extended the
 * monitor to scenario 11 by duplicating the same 10 lines. Slice
 * 124 (this) extracts the list to a single shared constant so:
 *
 *   * Future scenarios opt in with one import + one spread.
 *   * Latent-bug findings (fallback-company.png, the slice-80
 *     React warning) update ONE place, not N scenarios.
 *   * Drift between scenarios disappears — if one is updated and
 *     another isn't, that's no longer possible.
 *
 * ── Why two constants ──────────────────────────────────────────────
 * BASELINE_PAGE_ERROR_EXCLUSIONS — universal exclusions that fire
 * on ANY page mounted in the harness. Includes test-mode artifacts
 * (anvil unreachable, dummy Supabase) AND cross-page latent bugs
 * (fallback-company asset, hydration warnings, the React anti-
 * pattern warning from slice 80).
 *
 * MARKET_PAGE_PAGE_ERROR_EXCLUSIONS — currently identical to the
 * baseline. Reserved for future market-page-specific exclusions
 * that aren't appropriate to bake into the baseline (e.g., a
 * latent bug only the market page surfaces). Keeping the names
 * distinct prevents over-permissive baseline drift later.
 *
 * Scenarios should import the most-specific constant their surface
 * needs. /companies scenarios use BASELINE; /markets scenarios use
 * MARKET_PAGE; future surfaces add their own named constants.
 *
 * ── Adding to the list ─────────────────────────────────────────────
 * When a new latent error surfaces empirically:
 *   1. Confirm it's NOT a real bug. If it is, fix the upstream
 *      cause; don't paper over with an exclusion.
 *   2. If it's a test-mode artifact (anvil unreachable, dummy
 *      Supabase), or a known cross-page latent bug filed for
 *      separate fix, add a NARROW regex here with a one-line
 *      justifying comment.
 *   3. Never use `/.*​/` or any broad pattern that swallows
 *      future regressions.
 */

/**
 * Universal exclusions — fire on every page in the harness.
 * Used directly by /companies-scope scenarios (e.g., #48); also the
 * base for surface-specific lists.
 */
export const BASELINE_PAGE_ERROR_EXCLUSIONS = Object.freeze([
    // ── Test-mode artifacts (anvil unreachable) ─────────────
    // When HARNESS_NO_ANVIL=1 or anvil hasn't booted yet, every
    // contract call reverts with "missing revert data". Production
    // has a real RPC, so these aren't real bugs.
    /localhost:8546/,
    /SDAI contract.*missing revert data/,
    /check allowance.*missing revert data/,
    /Error fetching YES pool price/,           // legacy sushiswap fallback (anvil downstream)
    /Error fetching NO pool price/,            // legacy sushiswap fallback (anvil downstream)

    // ── Test-mode artifacts (dummy Supabase URL) ────────────
    // HARNESS_SUPABASE_URL is set to harness-supabase.invalid so
    // the Supabase client fails fast instead of hitting real
    // Supabase. The errors propagate but the app degrades cleanly.
    /harness-supabase\.invalid/,
    /Error fetching market data/,

    // ── Cross-page latent bugs (filed for separate fix) ─────
    // Real production bugs that pre-exist this harness work.
    // Excluding here so harness scenarios can guard against NEW
    // errors without being blocked. PROGRESS.md slice 79 + 80
    // entries track them.
    /fallback-company\.png/i,                  // public/ asset missing (slice 79)
    /Hydration failed/i,                       // SSR/client divergence

    // React anti-pattern warning: setState in one component
    // during render of another. Fires in production too —
    // intermittent. Narrow regex so similar warnings in different
    // call paths still surface.
    /Warning: Cannot update a component .* while rendering a different component/,
]);

/**
 * Market-page exclusions — currently identical to baseline.
 * Reserved for future market-page-specific test-mode artifacts
 * or latent bugs that don't belong in the universal list.
 */
export const MARKET_PAGE_PAGE_ERROR_EXCLUSIONS = Object.freeze([
    ...BASELINE_PAGE_ERROR_EXCLUSIONS,
    // Future market-page-specific exclusions go here. Examples:
    //   /unifiedBalanceFetcher.*timeout/,   // RPC-proxy first-call latency
    //   /SnapshotVote.*404/,                // Snapshot endpoint not mocked
    // Add narrowly with empirical justification + a tracking comment.
]);
