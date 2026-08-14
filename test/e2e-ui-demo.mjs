// Browser-level demonstration: the wizard's steps 1–3 driven ENTIRELY THROUGH
// THE UI (the built static export) against an anvil fork of Gnosis. All
// production RPC endpoints are routed to the fork; a minimal EIP-1193 wallet
// exposes anvil's unlocked client account. Zero Kelvin-signed transactions;
// the org owner appears once, before the UI run, for the setEditor grant
// (mixed-mode onboarding).
//
// Prereq: `npx next build` (out/ present). Run: node test/e2e-ui-demo.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';

const HARNESS_PW = '/Users/kas/interface/auto-qa/harness/node_modules/playwright/index.mjs';
const FORK_URL = process.env.FORK_URL || 'https://rpc.gnosischain.com';
const ANVIL = 'http://127.0.0.1:8548';
const ORG = '0xaAB097ead5c2Db1Ca7b1E5034224A2118EDAbe36';
const ORG_OWNER = '0xeb2aec308e7b3340dea2e89d40187d2637c6c649';
const KELVIN_EOA = '0x645a0b04e0891eb8b4a1a15dd547e3e29b17c157';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

async function serveOut(root, port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    for (const candidate of [p, `${p}.html`, `${p}/index.html`]) {
      try {
        const body = await readFile(join(root, candidate));
        res.writeHead(200, { 'Content-Type': MIME[extname(candidate)] || 'application/octet-stream' });
        return res.end(body);
      } catch { /* next */ }
    }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(port, r));
  return server;
}

// ── fork + one-time onboarding grant ─────────────────────────────────────
const anvilProc = spawn('anvil', ['--fork-url', FORK_URL, '--port', '8548', '--silent'], { stdio: 'ignore' });
const provider = new ethers.providers.JsonRpcProvider(ANVIL);
for (let i = 0; i < 60; i++) {
  try { await provider.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 1000)); }
}
const client = provider.getSigner(0);
const clientAddr = await client.getAddress();
await provider.send('anvil_impersonateAccount', [ORG_OWNER]);
await provider.send('anvil_setBalance', [ORG_OWNER, '0x8AC7230489E80000']);
const grantTx = await provider.getSigner(ORG_OWNER).sendTransaction({
  to: ORG,
  data: new ethers.utils.Interface(['function setEditor(address)']).encodeFunctionData('setEditor', [clientAddr]),
});
await grantTx.wait();
await provider.send('anvil_stopImpersonatingAccount', [ORG_OWNER]);
console.log(`fork ready — client ${clientAddr} granted editor() (org owner's only tx)`);

const httpServer = await serveOut(new URL('../out', import.meta.url).pathname, 8549);

// ── browser ──────────────────────────────────────────────────────────────
const { chromium } = await import(HARNESS_PW);
const browser = await chromium.launch({
  // harness playwright expects an older browser build than the cache holds —
  // point straight at the cached headless shell
  executablePath: '/Users/kas/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
const context = await browser.newContext();

// Route EVERY known production Gnosis RPC to the fork.
const RPC_HOSTS = ['rpc.gnosischain.com', 'gnosis.drpc.org', 'rpc.ankr.com', 'gnosis-rpc.publicnode.com', '1rpc.io', 'gnosis-mainnet.public.blastapi.io', 'rpc.gnosis.gateway.fm'];
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (RPC_HOSTS.some((h) => url.hostname.endsWith(h))) {
    const response = await fetch(ANVIL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: route.request().postData() });
    return route.fulfill({ status: 200, contentType: 'application/json', body: await response.text() });
  }
  return route.continue();
});

// Minimal EIP-1193 wallet: anvil's unlocked account 0, all calls proxied.
await context.addInitScript(`(() => {
  const RPC = ${JSON.stringify(ANVIL)};
  const ADDR = ${JSON.stringify(clientAddr)};
  let id = 1;
  const rpc = async (method, params) => {
    const r = await fetch(RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params: params || [] }) });
    const j = await r.json();
    if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
    return j.result;
  };
  const listeners = {};
  const emit = (event, payload) => (listeners[event] || []).forEach((fn) => { try { fn(payload); } catch {} });
  window.ethereum = {
    isMetaMask: true,
    _metamask: { isUnlocked: async () => true },
    chainId: '0x64',
    networkVersion: '100',
    selectedAddress: ADDR,
    isConnected: () => true,
    enable: async () => [ADDR],
    request: async ({ method, params }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        setTimeout(() => { emit('connect', { chainId: '0x64' }); emit('accountsChanged', [ADDR]); }, 0);
        return [ADDR];
      }
      if (method === 'eth_chainId') return '0x64';
      if (method === 'net_version') return '100';
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') return null;
      if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_sendTransaction') { params[0].from = params[0].from || ADDR; return rpc(method, params); }
      return rpc(method, params);
    },
    on: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); },
    addListener: (e, fn) => { (listeners[e] = listeners[e] || []).push(fn); },
    removeListener: (e, fn) => { listeners[e] = (listeners[e] || []).filter((f) => f !== fn); },
    removeAllListeners: (e) => { if (e) listeners[e] = []; },
  };
  window.dispatchEvent(new Event('ethereum#initialized'));
  // EIP-6963: announce as a discoverable wallet so RainbowKit/wagmi list it
  // with the plain injected connector (bypasses the MetaMask SDK handshake).
  const info = Object.freeze({
    uuid: '01890b5e-0000-4000-8000-e2edemowallet',
    name: 'Anvil Demo Wallet',
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="%23245"/></svg>',
    rdns: 'demo.anvil.fork',
  });
  const announce = () => window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze({ info, provider: window.ethereum }),
  }));
  window.addEventListener('eip6963:requestProvider', announce);
  announce();
})();`);

const page = await context.newPage();
page.setDefaultTimeout(90000);
page.on('console', (msg) => {
  if (msg.type() === 'error' || /connect|wallet|wagmi|rainbow/i.test(msg.text())) {
    console.log(`  [console.${msg.type()}] ${msg.text().slice(0, 200)}`);
  }
});
page.on('pageerror', (e) => console.log(`  [pageerror] ${String(e).slice(0, 200)}`));
const say = (m) => console.log(`  ${m}`);

try {
  await page.goto('http://127.0.0.1:8549/markets/new');
  await page.getByText('Market Defaults').first().waitFor();
  say('wizard rendered (static export, client-mounted)');

  // Connect wallet through RainbowKit's real modal.
  await page.getByRole('button', { name: /connect wallet/i }).first().click();
  const rkDialog = page.locator('[data-rk][role="dialog"]');
  await rkDialog.waitFor();
  const walletOption = rkDialog
    .locator('[data-testid="rk-wallet-option-demo.anvil.fork"], [data-testid^="rk-wallet-option"]:has-text("Anvil Demo")')
    .first();
  await walletOption.waitFor();
  // RainbowKit's entrance animation keeps the hit-test failing — bypass it.
  await walletOption.click({ force: true, timeout: 15000 })
    .catch(() => walletOption.dispatchEvent('click'));
  await page.waitForFunction(() => !document.body.innerText.match(/Connect a wallet to broadcast/i), null, { timeout: 30000 }).catch(() => {});
  say('wallet connected through RainbowKit');

  // Step 1 — broadcast createProposal from the UI.
  await page.getByRole('button', { name: /sign & broadcast/i }).click();
  await page.getByRole('button', { name: /^create proposal$/i }).click();
  const proposalLocator = page.locator('text=/proposal: 0x[a-fA-F0-9]{40}/');
  await proposalLocator.waitFor({ timeout: 120000 });
  const proposalAddress = (await proposalLocator.innerText()).match(/0x[a-fA-F0-9]{40}/)[0];
  say(`STEP 1 through UI — proposal created: ${proposalAddress}`);

  // The validator (correctly) refuses metadata without a snapshot_id — fill
  // the hash. The increment-D autofill fails closed for an unknown id, so the
  // manual close date stands.
  await page.locator('#snapshotId').fill('0x' + 'ab'.repeat(32));

  // Step 2 — simulate, then write metadata as the org editor.
  await page.getByText('Step 2 — Write proposal metadata').waitFor();
  await page.getByRole('button', { name: /simulate write/i }).click();
  await page.getByText(/Simulation OK/i).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: /sign & write metadata/i }).click();
  await page.getByText(/Metadata written/i).waitFor({ timeout: 120000 });
  say('STEP 2 through UI — metadata written by the client as editor');

  // Step 3 — create both pools, then verify invert flags.
  await page.getByText('Step 3 — Conditional pools').waitFor();
  await page.locator('#initialPrice').fill('0.02');
  await page.getByRole('button', { name: /create YES pool/i }).click();
  await page.getByText(/YES pool exists|Pool created/i).first().waitFor({ timeout: 120000 }).catch(() => {});
  await page.getByRole('button', { name: /create NO pool/i }).click();
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return /YES pool exists — 0x/.test(t) && /NO pool exists — 0x/.test(t);
  }, null, { timeout: 180000 });
  say('STEP 3 through UI — both conditional pools exist');

  await page.getByRole('button', { name: /verify invert flags/i }).click();
  await page.waitForFunction(() => /verified against on-chain token0 — correct|one transaction fixes/.test(document.body.innerText), null, { timeout: 60000 });
  if (await page.getByRole('button', { name: /fix flags/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /fix flags/i }).click();
    await page.getByText(/verified against on-chain token0 — correct/i).waitFor({ timeout: 120000 });
    say('invert flags were wrong on-chain — the UI corrected them with one tx');
  }
  say('invert flags VERIFIED through the UI');

  // Zero Kelvin transactions: scan every fork tx since genesis of our session.
  const latest = await provider.getBlockNumber();
  let kelvinTxs = 0;
  for (let b = latest; b > latest - 40 && b > 0; b--) {
    const block = await provider.getBlockWithTransactions(b);
    kelvinTxs += block.transactions.filter((t) => t.from.toLowerCase() === KELVIN_EOA).length;
  }
  assert.equal(kelvinTxs, 0, 'zero Kelvin-signed transactions');

  console.log('\nPASS UI — wizard steps 1–3 driven entirely through the real interface:');
  console.log(`  proposal ${proposalAddress} · metadata written · YES+NO pools · invert verified`);
  console.log('  0 Kelvin-signed txs; org owner only the pre-UI setEditor grant');
  console.log('  (LIVE seeding + resolution mechanics: node test/e2e-fork-demo.mjs --full)');
} catch (e) {
  console.error('UI DEMO FAILED:', e.message);
  await page.screenshot({ path: 'test/e2e-ui-demo-failure.png', fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  httpServer.close();
  anvilProc.kill();
}
