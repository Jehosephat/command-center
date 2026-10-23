import { dtoOperationFor } from '../dtoOperation';

describe('dtoOperationFor', () => {
  it('builds the asset channel token operation', () => {
    expect(
      dtoOperationFor('https://gateway-mainnet.galachain.com/api/asset/token-contract', 'TransferToken'),
    ).toBe('asset-channel_basic-asset_GalaChainToken:TransferToken');
  });

  it('tolerates a trailing slash', () => {
    expect(
      dtoOperationFor('https://gateway-testnet.galachain.com/api/asset/token-contract/', 'MintToken'),
    ).toBe('asset-channel_basic-asset_GalaChainToken:MintToken');
  });

  it('uses the channel name as channel and chaincode for game channels', () => {
    expect(
      dtoOperationFor('https://gateway-mainnet.galachain.com/api/mirandus/token-contract', 'BurnTokens'),
    ).toBe('mirandus_mirandus_GalaChainToken:BurnTokens');
  });

  it('maps spidertanks to its -channel suffixed channel', () => {
    expect(
      dtoOperationFor('https://gateway-mainnet.galachain.com/api/spidertanks/token-contract', 'TransferToken'),
    ).toBe('spidertanks-channel_spidertanks_GalaChainToken:TransferToken');
  });

  it('throws on an unknown channel', () => {
    expect(() =>
      dtoOperationFor('https://gateway-mainnet.galachain.com/api/nope/token-contract', 'TransferToken'),
    ).toThrow();
  });

  it('throws on an unrecognized URL', () => {
    expect(() => dtoOperationFor('https://example.com/foo', 'TransferToken')).toThrow();
  });
});
