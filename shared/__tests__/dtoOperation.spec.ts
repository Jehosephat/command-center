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

  it('falls back to the channel naming convention for other channels', () => {
    expect(
      dtoOperationFor('https://gateway-mainnet.galachain.com/api/mirandus/token-contract', 'BurnTokens'),
    ).toBe('mirandus-channel_basic-mirandus_GalaChainToken:BurnTokens');
  });

  it('throws on an unrecognized URL', () => {
    expect(() => dtoOperationFor('https://example.com/foo', 'TransferToken')).toThrow();
  });
});
