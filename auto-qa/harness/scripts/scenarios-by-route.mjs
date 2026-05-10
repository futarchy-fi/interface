#!/usr/bin/env node
// scenarios-by-route — group the captured Playwright scenarios by
// `route` field and print a route-counted summary + per-route detail.
//
// Sister to the api-side scenarios-by-layer ergonomics script. Same
// shape, different grouping key (route vs layer).
//
// At 9 scenarios all on /companies the summary is trivial, but the
// script becomes valuable as scenarios spread across routes —
// answers "what routes have scenario coverage?" / "where's the
// route gap?" in one glance.
//
// Output is plain text, deliberately scriptable. Pipe into grep/awk
// for filtering.
//
// Run via:  npm run scenarios:by-route
//      or:  npm run auto-qa:e2e:scenarios:by-route   (from interface root)

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, '..', 'scenarios');

const files = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.scenario.mjs'))
    .sort();

if (files.length === 0) {
    console.error('scenarios-by-route: no *.scenario.mjs files found in', SCENARIOS_DIR);
    process.exit(1);
}

const scenarios = await Promise.all(
    files.map(async (file) => {
        const url = pathToFileURL(join(SCENARIOS_DIR, file)).href;
        const mod = await import(url);
        const sc = mod.default;
        if (!sc?.name || !sc?.route) {
            throw new Error(`scenarios/${file}: missing default export name/route`);
        }
        return { file, name: sc.name, route: sc.route, bugShape: sc.bugShape };
    }),
);

const byRoute = new Map();
for (const sc of scenarios) {
    if (!byRoute.has(sc.route)) byRoute.set(sc.route, []);
    byRoute.get(sc.route).push(sc);
}

const routes = [...byRoute.keys()].sort();
const total = scenarios.length;
const widest = routes.reduce((w, r) => Math.max(w, r.length), 0);

console.log(`scenarios catalog: ${total} total across ${routes.length} routes`);
console.log('');

console.log('summary by route:');
for (const route of routes) {
    const count = byRoute.get(route).length;
    const pad = ' '.repeat(widest - route.length);
    const bar = '#'.repeat(count);
    console.log(`  ${route}${pad}  ${String(count).padStart(2)}  ${bar}`);
}
console.log('');

for (const route of routes) {
    console.log(`── ${route} (${byRoute.get(route).length}) ──`);
    for (const sc of byRoute.get(route)) {
        console.log(`  ${sc.name}`);
    }
    console.log('');
}
