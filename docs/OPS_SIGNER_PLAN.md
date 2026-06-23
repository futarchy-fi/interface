# Ops Signer Plan

## Goal

Build a small `/ops` page inside `futarchy.fi` where an authorized wallet, starting with `0xEB2AEC308e7B3340Dea2E89d40187D2637C6c649`, can connect with Rabby or another injected wallet and sign narrowly scoped administrative transactions.

The first target action is linking the GIP-151 Snapshot proposal to its Futarchy market through `SnapshotLinkRegistry.upsert(bytes32 snapshotId, uint256 futarchyId)`.

## Product Shape

The page should be an intent signer, not a raw transaction builder.

Each pending action is a typed, repo-backed manifest. The UI renders the human-readable intent, shows the exact contract/function/arguments, runs prechecks, simulates the transaction when possible, and only enables signing when the connected wallet and chain are correct.

The page must never accept arbitrary calldata from query params, a mutable database row, or free-form user input.

## Initial Route

- Add `src/pages/ops/index.jsx`.
- Use the existing app providers: Next.js, Wagmi, RainbowKit, viem, and the configured Gnosis Chain transport.
- Rabby should work as an injected wallet through RainbowKit/Wagmi.
- Require Gnosis Chain (`chainId: 100`) for the initial action set.
- Do not link this route from regular app navigation.
- Keep the route out of normal app navigation and mark it `noindex,nofollow`.

## Repository Layout

Suggested files:

- `src/ops/abis/snapshotLinkRegistry.js`
- `src/ops/actions/gip151.js`
- `src/ops/actions/index.js`
- `src/ops/actionTypes/snapshotLinkUpsert.js`
- `src/ops/components/OpsActionCard.jsx`
- `src/pages/ops/index.jsx`

Keep action builders and validation logic in the repo. Keep active action manifests in the repo for v0.

## Action Manifest Model

Each action should define:

- `id`
- `title`
- `description`
- `chainId`
- `requiredSigner`
- `target`
- `abi`
- `functionName`
- `args`
- `prechecks`
- `postcheck`
- `explorerLinks`

Example:

```js
export const gip151SnapshotLinkAction = {
  id: 'gip151-snapshot-link',
  title: 'Link GIP-151 Snapshot widget',
  chainId: 100,
  requiredSigner: '0xEB2AEC308e7B3340Dea2E89d40187D2637C6c649',
  target: '0xa6Bc2857906C808bc0041f3A2977F53c6b6b0823',
  functionName: 'upsert',
  args: [
    '0x657fbf8892200d24e887c68245cee73b59c466394192be1c10673b39814c74c4',
    435
  ],
  postcheck: {
    functionName: 'getFutarchyId',
    args: ['0x657fbf8892200d24e887c68245cee73b59c466394192be1c10673b39814c74c4'],
    expect: { id: 435, exists: true }
  }
};
```

The page should compute "pending" from chain state. An action is pending when its postcheck is false.

## GIP-151 Constants

- Snapshot proposal: `GIP-151: Should GnosisDAO offer a one-time pro-rata treasury redemption?`
- Snapshot id: `0x657fbf8892200d24e887c68245cee73b59c466394192be1c10673b39814c74c4`
- Snapshot space: `gnosis.eth`
- SnapshotLinkRegistry: `0xa6Bc2857906C808bc0041f3A2977F53c6b6b0823`
- SnapshotLinkRegistry owner: `0xEB2AEC308e7B3340Dea2E89d40187D2637C6c649`
- Expected FutarchyFactory id after the next market creation: `435`
- FutarchyFactory: `0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345`
- Expected GIP-151 market address from dry-run before sending: `0xeCe80208CB8376Be311cE0f5Ea4eF73850a0dcF0`

Before enabling the GIP-151 action, verify that `FutarchyFactory.proposals(435)` equals the actual created GIP-151 market address. If market creation changes the factory index, update the manifest before deployment.

## UI Requirements

The `/ops` page should show:

- Connected wallet address, unshortened or with an easy full-copy affordance.
- Current chain and required chain.
- Required signer for each action.
- Current postcheck status.
- Target contract, function name, decoded arguments, and Gnosisscan links.
- Simulation status where viem can simulate the write.
- A single "Sign transaction" button per action.
- Transaction hash, receipt status, and postcheck status after signing.

Disable signing when:

- Wallet is disconnected.
- Chain is not Gnosis.
- Connected wallet is not the required signer.
- Postcheck already passes.
- Precheck fails.
- Simulation fails.

## Safety Requirements

- No arbitrary calldata.
- No query-param controlled targets, ABIs, functions, or args.
- No backend signing.
- No private keys in the app.
- No hidden action execution on load.
- Require a direct click for every wallet signature.
- Show exact function and args before signing.
- Use postchecks to make completed actions disappear or show as complete.

Optional hardening:

- Put `/ops` behind Cloudflare Access.
- Add an action checksum to the UI for copy-review.
- Add a manual "I reviewed this transaction" checkbox for owner-only actions.

## Route Exposure

The page should be hidden from the regular app flow but should load directly at `/ops`.

Production behavior:

- `/ops` is a direct URL.
- The page is not linked from regular navigation.
- The page is marked `noindex,nofollow`.
- Transaction signing remains protected by wallet, chain, owner, precheck, simulation, and postcheck gates.

## First Implementation Steps

1. Add the SnapshotLinkRegistry ABI with `owner`, `getFutarchyId`, and `upsert`.
2. Add a typed `snapshotLinkUpsert` action builder.
3. Add the GIP-151 action manifest.
4. Build `/ops` around the existing Wagmi/RainbowKit providers.
5. Use `useAccount`, `useChainId`, `useSwitchChain`, `usePublicClient`, and `useWriteContract`.
6. Read `owner()` and `getFutarchyId(snapshotId)`.
7. Simulate `upsert(snapshotId, futarchyId)` when the connected wallet is the required signer.
8. Send the transaction through the connected wallet.
9. Wait for receipt and rerun postcheck.
10. Verify with a local Next.js build and browser smoke test.

## Acceptance Criteria

- `/ops` loads inside the existing app shell.
- Connecting Rabby as `0xEB2AEC308e7B3340Dea2E89d40187D2637C6c649` on Gnosis enables the GIP-151 Snapshot link action when the registry mapping is missing.
- Connecting any other wallet shows the action read-only and disabled.
- The page displays the exact `upsert` target, function, and args before signing.
- After signing, the page shows the tx hash and confirms `getFutarchyId(snapshotId) -> (435, true)`.
- If the mapping already exists, the action is marked complete and cannot be signed again.
- There is no free-form calldata path.

## Proposed `/goal` Command

```text
/goal Build and deploy a repo-backed `/ops` signer page in the futarchy.fi interface that lets the authorized wallet `0xEB2AEC308e7B3340Dea2E89d40187D2637C6c649` connect with Rabby on Gnosis Chain and sign typed, prechecked administrative actions. Implement the first action for GIP-151 Snapshot widget linking via `SnapshotLinkRegistry.upsert(0x657fbf8892200d24e887c68245cee73b59c466394192be1c10673b39814c74c4, 435)`, with owner/wallet/chain checks, explicit decoded transaction review, simulation where possible, receipt tracking, and postcheck confirmation through `getFutarchyId`. Keep allowed action builders and active action manifests in the repo, reject arbitrary calldata, run build/browser verification, and leave a concise handoff with file paths, verification results, and any deployment or signing steps still requiring the owner wallet.
```
