import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNFTsStore, type NFTSortOption } from '@/stores/nfts'
import { AllowanceType } from '@gala-chain/api'
import type { TokenBalance } from '@gala-chain/connect'
import type { TokenAllowance } from '@gala-chain/api'
import BigNumber from 'bignumber.js'

describe('nfts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  // Mock NFT balances
  const mockNFTBalances: TokenBalance[] = [
    {
      collection: 'TestCollection',
      category: 'Item',
      type: 'Sword',
      additionalKey: '',
      instanceIds: [new BigNumber(1), new BigNumber(2), new BigNumber(3)],
      quantity: new BigNumber(3),
      lockedHolds: [],
      inUseHolds: [],
    } as unknown as TokenBalance,
    {
      collection: 'AnotherCollection',
      category: 'Avatar',
      type: 'Character',
      additionalKey: '',
      instanceIds: [new BigNumber(100), new BigNumber(101)],
      quantity: new BigNumber(2),
      // TokenHold uses instanceId (singular) not instanceIds
      lockedHolds: [{ instanceId: new BigNumber(100), quantity: new BigNumber(1) }],
      inUseHolds: [],
    } as unknown as TokenBalance,
  ]

  // Mock fungible token balance (should be filtered out)
  const mockFungibleBalance: TokenBalance = {
    collection: 'GALA',
    category: 'Currency',
    type: 'GALA',
    additionalKey: '',
    instanceIds: [new BigNumber(0)],
    quantity: new BigNumber(1000),
    lockedHolds: [],
    inUseHolds: [],
  } as unknown as TokenBalance

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const store = useNFTsStore()
      expect(store.nfts).toEqual([])
      expect(store.collections).toEqual([])
      expect(store.selectedCollection).toBe(null)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.sortBy).toBe('collection-asc')
      expect(store.lastFetched).toBe(null)
    })

    it('should return hasNFTs as false initially', () => {
      const store = useNFTsStore()
      expect(store.hasNFTs).toBe(false)
    })

    it('should return zero counts initially', () => {
      const store = useNFTsStore()
      expect(store.totalNFTCount).toBe(0)
      expect(store.filteredCount).toBe(0)
    })
  })

  describe('setBalances action', () => {
    it('should process NFT balances and create individual NFT instances', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      // Should have 5 NFTs total (3 from TestCollection, 2 from AnotherCollection)
      expect(store.nfts.length).toBe(5)
      expect(store.hasNFTs).toBe(true)
    })

    it('should filter out fungible tokens', () => {
      const store = useNFTsStore()
      store.setBalances([mockFungibleBalance, ...mockNFTBalances])

      // Should only have NFTs, not the fungible token
      expect(store.nfts.length).toBe(5)
      expect(store.nfts.every(nft => nft.collection !== 'GALA')).toBe(true)
    })

    it('should extract unique collections', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      expect(store.collections.length).toBe(2)
      expect(store.collections.map(c => c.collection)).toContain('TestCollection')
      expect(store.collections.map(c => c.collection)).toContain('AnotherCollection')
    })

    it('should count owned NFTs per collection', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      const testCollection = store.collections.find(c => c.collection === 'TestCollection')
      const anotherCollection = store.collections.find(c => c.collection === 'AnotherCollection')

      expect(testCollection?.ownedCount).toBe(3)
      expect(anotherCollection?.ownedCount).toBe(2)
    })

    it('should set lastFetched timestamp', () => {
      const store = useNFTsStore()
      const beforeTime = Date.now()
      store.setBalances(mockNFTBalances)
      const afterTime = Date.now()

      expect(store.lastFetched).toBeGreaterThanOrEqual(beforeTime)
      expect(store.lastFetched).toBeLessThanOrEqual(afterTime)
    })

    it('should identify locked NFTs correctly', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      // Instance 100 in AnotherCollection is locked
      const lockedNFT = store.nfts.find(n => n.instance === '100')
      expect(lockedNFT?.isLocked).toBe(true)
      expect(lockedNFT?.canTransfer).toBe(false)
    })

    it('should mark unlocked NFTs as transferable', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      // Instance 1 in TestCollection is not locked
      const unlockedNFT = store.nfts.find(n => n.instance === '1')
      expect(unlockedNFT?.isLocked).toBe(false)
      expect(unlockedNFT?.canTransfer).toBe(true)
    })
  })

  describe('setAllowances action', () => {
    const mockBurnAllowance: TokenAllowance = {
      collection: 'TestCollection',
      category: 'Item',
      type: 'Sword',
      additionalKey: '',
      instance: new BigNumber(0),
      allowanceType: AllowanceType.Burn,
      grantedBy: 'admin',
      grantedTo: 'user',
      quantity: new BigNumber(100),
      quantitySpent: new BigNumber(0),
      uses: new BigNumber(0),
      usesSpent: new BigNumber(0),
      expires: 0,
    } as unknown as TokenAllowance

    it('should update canBurn flag on NFTs with burn allowance', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setAllowances([mockBurnAllowance], AllowanceType.Burn)

      // NFTs from TestCollection should have canBurn = true
      const testNFT = store.nfts.find(n => n.collection === 'TestCollection')
      expect(testNFT?.canBurn).toBe(true)

      // NFTs from AnotherCollection should have canBurn = false
      const anotherNFT = store.nfts.find(n => n.collection === 'AnotherCollection')
      expect(anotherNFT?.canBurn).toBe(false)
    })
  })

  describe('filteredNFTs getter', () => {
    it('should return all NFTs when no filter is set', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      expect(store.filteredNFTs.length).toBe(5)
    })

    it('should filter NFTs by collection when filter is set', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      // Set filter to TestCollection
      store.setCollectionFilter('TestCollection|Item|Sword|')

      expect(store.filteredNFTs.length).toBe(3)
      expect(store.filteredNFTs.every(nft => nft.collection === 'TestCollection')).toBe(true)
    })
  })

  describe('sortedNFTs getter', () => {
    it('should sort by collection ascending by default', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      const sorted = store.sortedNFTs
      // AnotherCollection should come before TestCollection
      expect(sorted[0].collection).toBe('AnotherCollection')
    })

    it('should sort by collection descending', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setSort('collection-desc')

      const sorted = store.sortedNFTs
      // TestCollection should come before AnotherCollection
      expect(sorted[0].collection).toBe('TestCollection')
    })

    it('should sort by instance ID ascending', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setSort('instance-asc')

      const sorted = store.sortedNFTs
      const instanceIds = sorted.map(n => parseInt(n.instance))
      for (let i = 1; i < instanceIds.length; i++) {
        expect(instanceIds[i]).toBeGreaterThanOrEqual(instanceIds[i - 1])
      }
    })

    it('should sort by instance ID descending', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setSort('instance-desc')

      const sorted = store.sortedNFTs
      const instanceIds = sorted.map(n => parseInt(n.instance))
      for (let i = 1; i < instanceIds.length; i++) {
        expect(instanceIds[i]).toBeLessThanOrEqual(instanceIds[i - 1])
      }
    })

    it('should sort by name ascending', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setSort('name-asc')

      const sorted = store.sortedNFTs
      // When collection is not 'Token', name is derived from collection
      // AnotherCollection comes before TestCollection alphabetically
      expect(sorted[0].name).toBe('AnotherCollection')
    })

    it('should sort by name descending', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setSort('name-desc')

      const sorted = store.sortedNFTs
      // When collection is not 'Token', name is derived from collection
      // TestCollection comes after AnotherCollection alphabetically
      expect(sorted[0].name).toBe('TestCollection')
    })
  })

  describe('setCollectionFilter action', () => {
    it('should set the selected collection filter', () => {
      const store = useNFTsStore()
      store.setCollectionFilter('TestCollection|Item|Sword|')

      expect(store.selectedCollection).toBe('TestCollection|Item|Sword|')
    })

    it('should clear the filter when null is passed', () => {
      const store = useNFTsStore()
      store.setCollectionFilter('TestCollection|Item|Sword|')
      store.setCollectionFilter(null)

      expect(store.selectedCollection).toBe(null)
    })
  })

  describe('clearFilter action', () => {
    it('should clear the selected collection filter', () => {
      const store = useNFTsStore()
      store.setCollectionFilter('TestCollection|Item|Sword|')
      store.clearFilter()

      expect(store.selectedCollection).toBe(null)
    })
  })

  describe('setSort action', () => {
    it('should update the sort order', () => {
      const store = useNFTsStore()
      store.setSort('instance-desc')

      expect(store.sortBy).toBe('instance-desc')
    })
  })

  describe('setLoading action', () => {
    it('should update loading state', () => {
      const store = useNFTsStore()
      store.setLoading(true)

      expect(store.isLoading).toBe(true)

      store.setLoading(false)
      expect(store.isLoading).toBe(false)
    })
  })

  describe('setError action', () => {
    it('should set error message', () => {
      const store = useNFTsStore()
      store.setError('Network error')

      expect(store.error).toBe('Network error')
    })

    it('should clear error when null is passed', () => {
      const store = useNFTsStore()
      store.setError('Some error')
      store.setError(null)

      expect(store.error).toBe(null)
    })
  })

  describe('clearNFTs action', () => {
    it('should reset all state', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setCollectionFilter('TestCollection|Item|Sword|')
      store.setError('Some error')
      store.setSort('instance-desc')

      store.clearNFTs()

      expect(store.nfts).toEqual([])
      expect(store.collections).toEqual([])
      expect(store.selectedCollection).toBe(null)
      expect(store.error).toBe(null)
      expect(store.lastFetched).toBe(null)
    })
  })

  describe('getNFTByKey action', () => {
    it('should find NFT by instance key', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      // setBalances tags balances with the default 'asset' channel
      const nft = store.getNFTByKey('asset|TestCollection|Item|Sword||1')
      expect(nft).toBeDefined()
      expect(nft?.instance).toBe('1')
      expect(nft?.channel).toBe('asset')
    })

    it('should return undefined for non-existent key', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      const nft = store.getNFTByKey('NonExistent|Key')
      expect(nft).toBeUndefined()
    })
  })

  describe('needsRefresh action', () => {
    it('should return true when never fetched', () => {
      const store = useNFTsStore()
      expect(store.needsRefresh()).toBe(true)
    })

    it('should return false immediately after fetch', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      expect(store.needsRefresh()).toBe(false)
    })
  })

  describe('count getters', () => {
    it('should return correct total count', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)

      expect(store.totalNFTCount).toBe(5)
    })

    it('should return correct filtered count', () => {
      const store = useNFTsStore()
      store.setBalances(mockNFTBalances)
      store.setCollectionFilter('TestCollection|Item|Sword|')

      expect(store.filteredCount).toBe(3)
    })
  })
})
