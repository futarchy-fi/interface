import { futarchyFactoryAbi } from '../abis/futarchyFactory';
import { snapshotLinkRegistryAbi } from '../abis/snapshotLinkRegistry';

export const GNOSIS_CHAIN_ID = 100;

export const FUTARCHY_FACTORY_ADDRESS = '0xa6cB18FCDC17a2B44E5cAd2d80a6D5942d30a345';
export const SNAPSHOT_LINK_REGISTRY_ADDRESS = '0xa6Bc2857906C808bc0041f3A2977F53c6b6b0823';
export const SNAPSHOT_LINK_REGISTRY_OWNER = '0xEB2AEC308e7B3340Dea2E89d40187D2637C6c649';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/;

function requireAddress(value, label) {
  if (!ADDRESS_RE.test(value || '')) {
    throw new Error(`${label} must be an EVM address`);
  }
  return value;
}

function requireBytes32(value, label) {
  if (!BYTES32_RE.test(value || '')) {
    throw new Error(`${label} must be a bytes32 value`);
  }
  return value;
}

function requireWholeNumber(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

export function buildSnapshotLinkUpsertAction({
  id,
  title,
  description,
  snapshotId,
  futarchyId,
  expectedMarketAddress,
  requiredSigner = SNAPSHOT_LINK_REGISTRY_OWNER,
}) {
  requireBytes32(snapshotId, 'snapshotId');
  requireWholeNumber(futarchyId, 'futarchyId');
  requireAddress(expectedMarketAddress, 'expectedMarketAddress');
  requireAddress(requiredSigner, 'requiredSigner');

  return {
    id,
    type: 'snapshotLinkRegistry.upsert',
    title,
    description,
    chainId: GNOSIS_CHAIN_ID,
    chainName: 'Gnosis Chain',
    requiredSigner,
    target: SNAPSHOT_LINK_REGISTRY_ADDRESS,
    targetLabel: 'SnapshotLinkRegistry',
    abi: snapshotLinkRegistryAbi,
    functionName: 'upsert',
    args: [snapshotId, BigInt(futarchyId)],
    displayArgs: [
      { label: 'snapshotId', value: snapshotId },
      { label: 'futarchyId', value: String(futarchyId) },
    ],
    explorerLinks: {
      target: `https://gnosisscan.io/address/${SNAPSHOT_LINK_REGISTRY_ADDRESS}`,
      requiredSigner: `https://gnosisscan.io/address/${requiredSigner}`,
      market: `https://gnosisscan.io/address/${expectedMarketAddress}`,
    },
    reads: {
      registryOwner: {
        address: SNAPSHOT_LINK_REGISTRY_ADDRESS,
        abi: snapshotLinkRegistryAbi,
        functionName: 'owner',
        expected: requiredSigner,
      },
      factoryProposal: {
        address: FUTARCHY_FACTORY_ADDRESS,
        abi: futarchyFactoryAbi,
        countFunctionName: 'marketsCount',
        functionName: 'proposals',
        args: [BigInt(futarchyId)],
        expected: expectedMarketAddress,
      },
      postcheck: {
        address: SNAPSHOT_LINK_REGISTRY_ADDRESS,
        abi: snapshotLinkRegistryAbi,
        functionName: 'getFutarchyId',
        args: [snapshotId],
        expected: { id: BigInt(futarchyId), exists: true },
      },
    },
  };
}
