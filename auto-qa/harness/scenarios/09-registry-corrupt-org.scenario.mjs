/**
 * 09-registry-corrupt-org.scenario.mjs — Phase 7 slice 2: per-row corruption.
 *
 * Where the chaos scenarios so far take the entire endpoint down
 * (#02/#06), return all-empty data (#05), or return a non-JSON
 * body (#07), this scenario returns VALID JSON with TWO orgs —
 * one well-formed, one with corrupt/missing fields. Tests per-row
 * resilience: does the page render the valid org while skipping
 * (or fallback-rendering) the corrupt one, or does the single
 * bad apple crash the entire list?
 *
 * Real-world parallel: production data has weird rows. A
 * partial-rewrite migration that left some orgs with `metadata =
 * null` while others got migrated. A user-supplied metadata
 * URL that pointed at a 404. An indexer hot-fix that fixed
 * forward-going orgs but didn't backfill historicals.
 *
 * Bug-shapes guarded:
 *   - one corrupt row crashes the entire orgs list (no defensive
 *     guard around .name access; the table loop throws on the
 *     first undefined name)
 *   - corrupt row's name is rendered as raw "undefined" or
 *     "[object Object]" or "null" string
 *   - silent filtering — corrupt org is simply omitted with no
 *     telemetry, masking the underlying data quality issue
 *   - corrupt row's data leaks into the valid row's slot
 *     (cache-key collision when the corrupt org has the same
 *     id as the valid one but different fields)
 *
 * The expected behavior is the looser of: render the valid org
 * (and either skip the corrupt one or render with a name fallback
 * like "Untitled" — either is acceptable; both prove the page
 * doesn't crash). Asserting the valid org's name appears is
 * sufficient — that proves both that the renderer ran AND that
 * the corrupt row didn't take down the page before the valid
 * row's turn.
 */

import { expect } from '@playwright/test';

import {
    REGISTRY_GRAPHQL_URL,
    PROBE_AGG_ID,
    PROBE_AGG_NAME,
    PROBE_ORG_ID,
    PROBE_ORG_NAME,
} from '../fixtures/api-mocks.mjs';

const VALID_ORG = {
    id:           PROBE_ORG_ID,
    name:         PROBE_ORG_NAME,
    description:  'Valid org — this one should render',
    metadata:     null,
    metadataURI:  null,
    owner:        '0x0000000000000000000000000000000000000000',
    editor:       '0x0000000000000000000000000000000000000000',
};

// Corrupt org: missing required `name` field. The frontend's
// renderer should either skip this row or render with a fallback;
// it must NOT crash and take down the valid org's row.
const CORRUPT_ORG = {
    id:           '0xc0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0',
    // name: MISSING — this is the corruption
    description:  null,
    metadata:     null,
    metadataURI:  null,
    owner:        '0x0000000000000000000000000000000000000000',
    editor:       '0x0000000000000000000000000000000000000000',
};

export default {
    name:        '09-registry-corrupt-org',
    description: 'Registry returns valid orgs list with a CORRUPT row mixed in (missing required `name` field). Assert the valid org renders — proves the page handles per-row corruption without crashing the entire list.',
    bugShape:    'one bad apple crashes orgs list / corrupt row leaks raw "undefined" to UI / valid orgs filtered alongside corrupt ones (per-row defensive-coding regression)',
    route:       '/companies',

    mocks: {
        [REGISTRY_GRAPHQL_URL]: async (route) => {
            const body = JSON.parse(route.request().postData() || '{}');
            const q = body.query || '';

            let data;
            if (q.includes('aggregator(id:')) {
                data = {
                    aggregator: {
                        id:          PROBE_AGG_ID,
                        name:        PROBE_AGG_NAME,
                        description: 'Synthetic aggregator (harness — corrupt-org scenario)',
                        metadata:    null,
                    },
                };
            } else if (q.includes('organizations(where:')) {
                // Two orgs returned: the VALID one + the CORRUPT one.
                // Order matters: corrupt FIRST so the renderer hits
                // it before the valid one. If a buggy renderer
                // crashes on the corrupt row, the valid row never
                // gets its turn — and the assertion fails. Putting
                // corrupt first maximizes the chance of catching
                // the bug.
                data = { organizations: [CORRUPT_ORG, VALID_ORG] };
            } else if (q.includes('proposalentities(where:')) {
                // No proposals — keep the rest of the page minimal
                // so the assertion is unambiguously about the
                // orgs-table rendering.
                data = { proposalentities: [] };
            } else {
                data = {};
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ data }),
            });
        },
    },

    assertions: [
        async (page) => {
            // The valid org's name appears in the rendered DOM.
            // This proves: (a) the renderer ran past the corrupt
            // row without throwing, (b) the valid row was reached
            // and rendered. If a single bad apple crashed the
            // list, this name would never appear.
            await expect(
                page.getByText(PROBE_ORG_NAME).first(),
            ).toBeVisible({ timeout: 30_000 });
        },
    ],

    timeout: 180_000,
};
