export const snapshotLinkRegistryAbi = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'bytes32', name: 'snapshotId', type: 'bytes32' }],
    name: 'getFutarchyId',
    outputs: [
      { internalType: 'uint256', name: 'id', type: 'uint256' },
      { internalType: 'bool', name: 'exists', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'bytes32', name: 'snapshotId', type: 'bytes32' },
      { internalType: 'uint256', name: 'futarchyId', type: 'uint256' },
    ],
    name: 'upsert',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];
