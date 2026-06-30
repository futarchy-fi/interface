import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const flmConfig = JSON.parse(await readFile(resolve(root, 'src/config/flm.json'), 'utf8'));

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const optionalAddress = (value) => value === '' || ADDRESS_RE.test(value);
const bySlug = Object.fromEntries(flmConfig.map((config) => [config.slug, config]));

test('liquidity manager config pins Kleros and Gnosis organization routes', () => {
    assert.deepEqual(Object.keys(bySlug).sort(), ['gnosis', 'kleros']);

    assert.equal(bySlug.kleros.path, '/flm/kleros');
    assert.equal(bySlug.kleros.organizationAddress, '0xaab097ead5c2db1ca7b1e5034224a2118edabe36');
    assert.equal(bySlug.kleros.companyId, 10);

    assert.equal(bySlug.gnosis.path, '/flm/gnosis');
    assert.equal(bySlug.gnosis.organizationAddress, '0x3fd2e8e71f75eed4b5c507706c413e33e0661bbf');
    assert.equal(bySlug.gnosis.companyId, 9);
});

test('liquidity manager proposal metadata keeps the current official markets discoverable', () => {
    assert.equal(bySlug.kleros.activeProposal.label, 'KIP-90');
    assert.equal(bySlug.kleros.activeProposal.marketAddress, '0x84412Fe9D088C1D8Dd676a7be9a3d5d0291Ab1Cf');
    assert.equal(
        bySlug.kleros.activeProposal.snapshotId,
        '0xba2749a4f1283da9d1ca925d9f17bf712fa06a23e6a07d759c54340277820932'
    );
    assert.equal(bySlug.kleros.activeProposal.marketUrl, '/markets/0x84412Fe9D088C1D8Dd676a7be9a3d5d0291Ab1Cf');

    assert.equal(bySlug.gnosis.activeProposal.label, 'GIP-151');
    assert.equal(bySlug.gnosis.activeProposal.marketAddress, '0xeCe80208CB8376Be311cE0f5Ea4eF73850a0dcF0');
    assert.equal(
        bySlug.gnosis.activeProposal.snapshotId,
        '0x657fbf8892200d24e887c68245cee73b59c466394192be1c10673b39814c74c4'
    );
    assert.equal(bySlug.gnosis.activeProposal.marketUrl, '/markets/0xeCe80208CB8376Be311cE0f5Ea4eF73850a0dcF0');
});

test('liquidity manager token and contract fields use valid address shapes', () => {
    for (const config of flmConfig) {
        assert.equal(config.chainId, 100);
        assert.match(config.token.address, ADDRESS_RE);
        assert.match(config.collateral.address, ADDRESS_RE);
        assert.ok(optionalAddress(config.managerAddress), `${config.slug} manager address shape`);
        assert.ok(optionalAddress(config.proposalSourceAddress), `${config.slug} proposal source shape`);
        assert.ok(optionalAddress(config.activeProposal.proposalMetadataAddress), `${config.slug} metadata shape`);
    }
});

test('liquidity manager helpers pin Swapr adapter calldata and manager overloads', async () => {
    const utilsSource = await readFile(resolve(root, 'src/utils/flm.js'), 'utf8');
    const pageSource = await readFile(resolve(root, 'src/pages/flm/[org].jsx'), 'utf8');

    assert.match(
        utilsSource,
        /tuple\(int24 tickLower,int24 tickUpper,uint256 amount0Min,uint256 amount1Min,uint256 deadline,uint160 sqrtPriceX96\)/
    );
    assert.match(
        utilsSource,
        /tuple\(uint256 amount0Min,uint256 amount1Min,uint256 deadline\)/
    );
    assert.match(pageSource, /depositToSpot\(uint256,uint256,bytes\)/);
    assert.match(pageSource, /encodeDualExitParams\(yesExitData, noExitData\)/);
});

test('companies table links configured organizations to their liquidity page', async () => {
    const hookSource = await readFile(resolve(root, 'src/hooks/useAggregatorCompanies.js'), 'utf8');
    const rowSource = await readFile(resolve(root, 'src/components/futarchyFi/companyList/table/OrgRow.jsx'), 'utf8');

    assert.match(hookSource, /flmPath: getFlmPathForOrg\(org\.id\)/);
    assert.match(rowSource, /href=\{flmPath\}/);
    assert.match(rowSource, /event\.stopPropagation\(\)/);
});
