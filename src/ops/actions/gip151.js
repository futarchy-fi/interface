import { buildSnapshotLinkUpsertAction } from '../actionTypes/snapshotLinkUpsert';

export const gip151SnapshotLinkAction = buildSnapshotLinkUpsertAction({
  id: 'gip151-snapshot-link',
  title: 'Link GIP-151 Snapshot widget',
  description:
    'Registers the GIP-151 Snapshot proposal hash against its FutarchyFactory id so the Snapshot widget can resolve the market.',
  snapshotId: '0x657fbf8892200d24e887c68245cee73b59c466394192be1c10673b39814c74c4',
  futarchyId: 435,
  expectedMarketAddress: '0xeCe80208CB8376Be311cE0f5Ea4eF73850a0dcF0',
});
