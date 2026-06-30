const KNOWN_TIERS = new Set(['interaction', 'fork']);

export function scenarioIdFromFile(file) {
    const id = String(file ?? '').match(/^(\d+)-/)?.[1];
    return id ?? null;
}

export function normalizeTierList(value) {
    if (!value) return [];
    const values = Array.isArray(value) ? value : [value];
    return values
        .map((v) => String(v).trim())
        .filter(Boolean);
}

export function scenarioTiers(scenario) {
    return [...new Set(normalizeTierList(scenario?.ciTiers))].sort();
}

export function scenarioNeedsAnvil(scenario) {
    return Boolean(scenario?.requiresAnvil || scenario?.useAnvilRpcProxy);
}

export function assertKnownScenarioTiers(file, scenario) {
    const tiers = scenarioTiers(scenario);
    for (const tier of tiers) {
        if (!KNOWN_TIERS.has(tier)) {
            throw new Error(
                `scenarios/${file}: unknown ciTier "${tier}". ` +
                `Known tiers: ${[...KNOWN_TIERS].sort().join(', ')}`,
            );
        }
    }
    if (tiers.includes('fork') && !scenarioNeedsAnvil(scenario)) {
        throw new Error(
            `scenarios/${file}: ciTier "fork" requires requiresAnvil or useAnvilRpcProxy`,
        );
    }
    if (tiers.length > 0 && scenario?.pinnedLatentBug) {
        throw new Error(
            `scenarios/${file}: pinned latent bugs cannot be promoted to CI tiers`,
        );
    }
}

export function scenarioMatchesTier(scenario, tier) {
    if (!tier) return true;
    return scenarioTiers(scenario).includes(tier);
}

export function parseScenarioIds(value) {
    return new Set(
        String(value ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
    );
}

export function scenarioMatchesIds(file, ids) {
    if (!ids || ids.size === 0) return true;
    const id = scenarioIdFromFile(file);
    return id ? ids.has(id) : false;
}
