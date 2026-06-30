#!/usr/bin/env node

import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    assertKnownScenarioTiers,
    scenarioNeedsAnvil,
    scenarioTiers,
} from '../fixtures/scenario-tiers.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, '..', 'scenarios');

const files = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith('.scenario.mjs'))
    .sort();

const byTier = new Map();
const unassigned = [];
const anvilRequiredUnpromoted = [];

for (const file of files) {
    const mod = await import(pathToFileURL(join(SCENARIOS_DIR, file)).href);
    const scenario = mod.default;
    if (!scenario?.name) throw new Error(`scenarios/${file}: missing scenario name`);
    assertKnownScenarioTiers(file, scenario);
    const tiers = scenarioTiers(scenario);
    if (tiers.length === 0) {
        unassigned.push({ file, scenario });
        if (scenarioNeedsAnvil(scenario)) {
            anvilRequiredUnpromoted.push({ file, scenario });
        }
        continue;
    }
    for (const tier of tiers) {
        if (!byTier.has(tier)) byTier.set(tier, []);
        byTier.get(tier).push({ file, scenario });
    }
}

console.log(`scenarios catalog: ${files.length} total`);
console.log('');

for (const tier of [...byTier.keys()].sort()) {
    const rows = byTier.get(tier);
    console.log(`-- ${tier} (${rows.length}) --`);
    for (const { file, scenario } of rows) {
        console.log(`  ${file}  ${scenario.name}`);
    }
    console.log('');
}

console.log(`unassigned: ${unassigned.length}`);
console.log(`anvil-required unpromoted: ${anvilRequiredUnpromoted.length}`);
