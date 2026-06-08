/**
 * Test fixtures for NFTs
 */
import type { TokenBalance } from '@gala-chain/connect';
import type { NFTDisplay, CollectionDisplay } from '@shared/types/display';
import BigNumber from 'bignumber.js';

// Mock NFT TokenBalance objects (from GalaChain API)
export const mockNFTBalances: TokenBalance[] = [
  {
    collection: 'SpiderTanks',
    category: 'Tanks',
    type: 'LightTank',
    additionalKey: '',
    instanceIds: [new BigNumber(1), new BigNumber(2), new BigNumber(3)],
    quantity: new BigNumber(3),
    lockedHolds: [],
    inUseHolds: [],
  } as unknown as TokenBalance,
  {
    collection: 'SpiderTanks',
    category: 'Tanks',
    type: 'HeavyTank',
    additionalKey: '',
    instanceIds: [new BigNumber(100), new BigNumber(101)],
    quantity: new BigNumber(2),
    lockedHolds: [{ instanceId: new BigNumber(100), quantity: new BigNumber(1), name: 'Staked' }],
    inUseHolds: [],
  } as unknown as TokenBalance,
  {
    collection: 'TownStar',
    category: 'Buildings',
    type: 'Windmill',
    additionalKey: '',
    instanceIds: [new BigNumber(500)],
    quantity: new BigNumber(1),
    lockedHolds: [],
    inUseHolds: [{ instanceId: new BigNumber(500), quantity: new BigNumber(1), name: 'In Game' }],
  } as unknown as TokenBalance,
];

// Mock fungible token balance (should be filtered out from NFT lists)
export const mockFungibleBalance: TokenBalance = {
  collection: 'GALA',
  category: 'Currency',
  type: 'GALA',
  additionalKey: '',
  instanceIds: [new BigNumber(0)],
  quantity: new BigNumber(1000),
  lockedHolds: [],
  inUseHolds: [],
} as unknown as TokenBalance;

// Mock NFTDisplay objects (UI display format)
export const mockNFTDisplays: NFTDisplay[] = [
  {
    instanceKey: 'asset|SpiderTanks|Tanks|LightTank||1',
    channel: 'asset',
    collection: 'SpiderTanks',
    category: 'Tanks',
    type: 'LightTank',
    additionalKey: '',
    instance: '1',
    name: 'Light Tank #1',
    symbol: 'TANK',
    description: 'A nimble light tank',
    image: 'https://example.com/tank1.png',
    rarity: 'Common',
    isLocked: false,
    isInUse: false,
    canTransfer: true,
    canBurn: false,
  },
  {
    instanceKey: 'asset|SpiderTanks|Tanks|LightTank||2',
    channel: 'asset',
    collection: 'SpiderTanks',
    category: 'Tanks',
    type: 'LightTank',
    additionalKey: '',
    instance: '2',
    name: 'Light Tank #2',
    symbol: 'TANK',
    description: 'A nimble light tank',
    image: 'https://example.com/tank2.png',
    rarity: 'Common',
    isLocked: false,
    isInUse: false,
    canTransfer: true,
    canBurn: false,
  },
  {
    instanceKey: 'asset|SpiderTanks|Tanks|HeavyTank||100',
    channel: 'asset',
    collection: 'SpiderTanks',
    category: 'Tanks',
    type: 'HeavyTank',
    additionalKey: '',
    instance: '100',
    name: 'Heavy Tank #100',
    symbol: 'TANK',
    description: 'A powerful heavy tank',
    image: 'https://example.com/heavy100.png',
    rarity: 'Legendary',
    isLocked: true,
    isInUse: false,
    canTransfer: false,
    canBurn: false,
  },
  {
    instanceKey: 'asset|TownStar|Buildings|Windmill||500',
    channel: 'asset',
    collection: 'TownStar',
    category: 'Buildings',
    type: 'Windmill',
    additionalKey: '',
    instance: '500',
    name: 'Windmill #500',
    symbol: 'BLDG',
    description: 'Generates energy',
    image: 'https://example.com/windmill.png',
    isLocked: false,
    isInUse: true,
    canTransfer: false,
    canBurn: true,
  },
];

// Single NFT displays for simple tests
export const mockLightTank1: NFTDisplay = mockNFTDisplays[0];
export const mockLightTank2: NFTDisplay = mockNFTDisplays[1];
export const mockLockedHeavyTank: NFTDisplay = mockNFTDisplays[2];
export const mockInUseWindmill: NFTDisplay = mockNFTDisplays[3];

// NFT that can be burned
export const mockBurnableNFT: NFTDisplay = {
  ...mockLightTank1,
  canBurn: true,
};

// NFT that is locked (cannot transfer)
export const mockLockedNFT: NFTDisplay = mockLockedHeavyTank;

// NFT that is in use (cannot transfer)
export const mockInUseNFT: NFTDisplay = mockInUseWindmill;

// Mock CollectionDisplay objects for NFT collections
export const mockCollectionDisplays: CollectionDisplay[] = [
  {
    collectionKey: 'SpiderTanks|Tanks||',
    collection: 'SpiderTanks',
    category: 'Tanks',
    type: '',
    additionalKey: '',
    name: 'Spider Tanks',
    symbol: 'TANK',
    description: 'NFT collection of battle tanks',
    image: 'https://example.com/spidertanks.png',
    isNonFungible: true,
    maxSupply: '10000',
    totalSupply: '5234',
    totalBurned: '123',
    isAuthority: false,
    ownedCount: 5,
  },
  {
    collectionKey: 'TownStar|Buildings||',
    collection: 'TownStar',
    category: 'Buildings',
    type: '',
    additionalKey: '',
    name: 'Town Star Buildings',
    symbol: 'BLDG',
    description: 'NFT buildings for Town Star',
    image: 'https://example.com/townstar.png',
    isNonFungible: true,
    maxSupply: '0', // unlimited
    totalSupply: '12456',
    totalBurned: '567',
    isAuthority: true,
    ownedCount: 1,
  },
];

// Single collection for simple tests
export const mockSpiderTanksCollection: CollectionDisplay = mockCollectionDisplays[0];
export const mockTownStarCollection: CollectionDisplay = mockCollectionDisplays[1];

// Factory functions
export function createMockNFTDisplay(overrides: Partial<NFTDisplay> = {}): NFTDisplay {
  return {
    ...mockLightTank1,
    ...overrides,
  };
}

export function createMockNFTBalance(
  collection: string,
  category: string,
  type: string,
  instanceIds: number[],
  options: {
    lockedInstanceIds?: number[];
    inUseInstanceIds?: number[];
  } = {},
): TokenBalance {
  const lockedHolds = (options.lockedInstanceIds ?? []).map((id) => ({
    instanceId: new BigNumber(id),
    quantity: new BigNumber(1),
    name: 'Locked',
  }));
  const inUseHolds = (options.inUseInstanceIds ?? []).map((id) => ({
    instanceId: new BigNumber(id),
    quantity: new BigNumber(1),
    name: 'In Use',
  }));

  return {
    collection,
    category,
    type,
    additionalKey: '',
    instanceIds: instanceIds.map((id) => new BigNumber(id)),
    quantity: new BigNumber(instanceIds.length),
    lockedHolds,
    inUseHolds,
  } as unknown as TokenBalance;
}

export function createMockCollectionDisplay(
  overrides: Partial<CollectionDisplay> = {},
): CollectionDisplay {
  return {
    ...mockSpiderTanksCollection,
    ...overrides,
  };
}
