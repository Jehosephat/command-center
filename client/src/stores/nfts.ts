import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import BigNumber from 'bignumber.js'
import type { TokenBalance as TokenBalanceConnect } from '@gala-chain/connect'
import type { TokenAllowance, AllowanceType, TokenBalanceWithMetadata, TokenClass, TokenBalance as TokenBalanceApi } from '@gala-chain/api'
import type { NFTDisplay, CollectionDisplay } from '@shared/types/display'
import { getTokenIdentifier } from '@/lib/tokenUtils'

// Use a unified type that works for both API sources
type TokenBalanceAny = TokenBalanceConnect | TokenBalanceApi

// Interface for accessing TokenBalance properties regardless of source
// This helps with type casting when accessing properties that may be private in one variant
interface TokenBalanceData {
  collection: string
  category: string
  type: string
  additionalKey: string
  quantity?: BigNumber
  instanceIds?: BigNumber[]
  lockedHolds?: Array<{ quantity: BigNumber; instanceId?: BigNumber }>
  inUseHolds?: Array<{ quantity: BigNumber; instanceId?: BigNumber }>
}

/**
 * Sort options for the NFT list
 */
export type NFTSortOption = 'collection-asc' | 'collection-desc' | 'instance-asc' | 'instance-desc' | 'name-asc' | 'name-desc'

/** Allowed NFT page sizes */
export const NFT_PAGE_SIZES = [10, 25, 50] as const
export type NFTPageSize = (typeof NFT_PAGE_SIZES)[number]

/**
 * Convert a TokenBalance (with NFT instance) to NFTDisplay
 */
function toNFTDisplay(
  balance: TokenBalanceAny,
  instanceId: BigNumber,
  burnAllowances: TokenAllowance[],
  channel: string,
  tokenMetadata?: TokenClass
): NFTDisplay {
  // Cast to data interface for property access (avoids private property issues)
  const b = balance as unknown as TokenBalanceData
  const instanceKey = `${channel}|${b.collection}|${b.category}|${b.type}|${b.additionalKey}|${instanceId.toString()}`

  // Calculate if NFT is locked or in use
  // TokenHold has instanceId (singular) for the specific instance being held
  const lockedInstances = b.lockedHolds?.map((h: { instanceId?: BigNumber }) => h.instanceId).filter(Boolean) || []
  const inUseInstances = b.inUseHolds?.map((h: { instanceId?: BigNumber }) => h.instanceId).filter(Boolean) || []

  const isLocked = lockedInstances.some((id: BigNumber | undefined) => new BigNumber(id?.toString() || '0').eq(instanceId))
  const isInUse = inUseInstances.some((id: BigNumber | undefined) => new BigNumber(id?.toString() || '0').eq(instanceId))

  // Check for burn allowance for this NFT
  const hasBurnAllowance = burnAllowances.some(
    a => a.collection === b.collection &&
         a.category === b.category &&
         a.type === b.type &&
         a.additionalKey === b.additionalKey &&
         (a.instance === undefined || new BigNumber(a.instance?.toString() || '0').eq(instanceId) || new BigNumber(a.instance?.toString() || '0').isZero())
  )

  // Can transfer if not locked and not in use
  const canTransfer = !isLocked && !isInUse

  // Use metadata if available, otherwise fall back to defaults
  // For default name/symbol, use getTokenIdentifier which returns collection if not 'Token', otherwise type
  const tokenIdentifier = getTokenIdentifier(b)
  const name = tokenMetadata?.name || tokenIdentifier || 'Unknown NFT'
  const symbol = tokenMetadata?.symbol || tokenIdentifier || '???'
  const description = tokenMetadata?.description || ''
  const image = tokenMetadata?.image || ''
  const rarity = tokenMetadata?.rarity

  return {
    instanceKey,
    channel,
    collection: b.collection,
    category: b.category,
    type: b.type,
    additionalKey: b.additionalKey,
    instance: instanceId.toString(),
    name,
    symbol,
    description,
    image,
    rarity,
    isLocked,
    isInUse,
    canTransfer,
    canBurn: hasBurnAllowance,
  }
}

/**
 * Extract unique collections from NFT balances, keyed by the `collection`
 * field only (the first part of the TokenClassKey). All category/type/
 * additionalKey variants of the same collection are grouped together.
 *
 * Metadata (name, image, etc.) is taken from the first NFT encountered for
 * each collection — token classes within one collection often share these.
 */
function extractCollections(nfts: NFTDisplay[]): CollectionDisplay[] {
  const collectionMap = new Map<string, CollectionDisplay>()

  for (const nft of nfts) {
    const collectionKey = nft.collection

    const existing = collectionMap.get(collectionKey)
    if (existing) {
      existing.ownedCount++
    } else {
      collectionMap.set(collectionKey, {
        collectionKey,
        collection: nft.collection,
        category: '',
        type: '',
        additionalKey: '',
        name: nft.collection,
        symbol: nft.symbol,
        description: nft.description,
        image: nft.image,
        isNonFungible: true,
        maxSupply: '0',
        totalSupply: '0',
        totalBurned: '0',
        isAuthority: false,
        ownedCount: 1,
      })
    }
  }

  return Array.from(collectionMap.values())
}

/**
 * Pinia store for managing NFT state
 */
export const useNFTsStore = defineStore('nfts', () => {
  // State
  const nfts = ref<NFTDisplay[]>([])
  const collections = ref<CollectionDisplay[]>([])
  const selectedCollection = ref<string | null>(null)
  const selectedChannel = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const sortBy = ref<NFTSortOption>('collection-asc')
  const lastFetched = ref<number | null>(null)
  const pageSize = ref<NFTPageSize>(10)
  const currentPage = ref(1)

  // Raw data from API (for re-processing when allowances change), keyed by channel.
  // Use TokenBalanceAny to handle both @gala-chain/connect and @gala-chain/api versions
  let rawBalancesByChannel: Map<string, TokenBalanceAny[]> = new Map()
  let rawBalancesWithMetadataByChannel: Map<string, TokenBalanceWithMetadata[]> = new Map()
  let rawBurnAllowances: TokenAllowance[] = []
  let usingMetadata = false // Track whether we have metadata

  // Getters
  const filteredNFTs = computed(() => {
    let result = nfts.value

    if (selectedCollection.value) {
      result = result.filter(nft => nft.collection === selectedCollection.value)
    }

    if (selectedChannel.value) {
      result = result.filter(nft => nft.channel === selectedChannel.value)
    }

    return result
  })

  /** Channels that have at least one NFT in the current fetch, deduped, sorted. */
  const availableChannels = computed(() => {
    const set = new Set<string>()
    for (const nft of nfts.value) set.add(nft.channel)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  })

  const sortedNFTs = computed(() => {
    const sorted = [...filteredNFTs.value]

    switch (sortBy.value) {
      case 'collection-asc':
        return sorted.sort((a, b) => a.collection.localeCompare(b.collection))
      case 'collection-desc':
        return sorted.sort((a, b) => b.collection.localeCompare(a.collection))
      case 'instance-asc':
        return sorted.sort((a, b) => {
          const aInstance = new BigNumber(a.instance)
          const bInstance = new BigNumber(b.instance)
          const cmp = aInstance.comparedTo(bInstance)
          return cmp === null ? 0 : cmp
        })
      case 'instance-desc':
        return sorted.sort((a, b) => {
          const aInstance = new BigNumber(a.instance)
          const bInstance = new BigNumber(b.instance)
          const cmp = bInstance.comparedTo(aInstance)
          return cmp === null ? 0 : cmp
        })
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name))
      default:
        return sorted
    }
  })

  const hasNFTs = computed(() => nfts.value.length > 0)

  const totalNFTCount = computed(() => nfts.value.length)

  const filteredCount = computed(() => filteredNFTs.value.length)

  /** Total number of pages given the current pageSize and filtered set. */
  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filteredCount.value / pageSize.value)),
  )

  /** Slice of sortedNFTs for the current page. */
  const pagedNFTs = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return sortedNFTs.value.slice(start, start + pageSize.value)
  })

  // Actions

  /**
   * Replace all raw balances (single 'asset' channel batch).
   * @deprecated Use setBalancesWithMetadata for better display data.
   */
  function setBalances(balances: TokenBalanceAny[]): void {
    rawBalancesByChannel = new Map([['asset', balances]])
    rawBalancesWithMetadataByChannel = new Map()
    usingMetadata = false
    processNFTs()
  }

  /**
   * Replace all raw balances with metadata (single 'asset' channel batch).
   * This is the preferred method as it includes token class data (name, symbol, image, etc.)
   */
  function setBalancesWithMetadata(balancesWithMetadata: TokenBalanceWithMetadata[]): void {
    rawBalancesWithMetadataByChannel = new Map([['asset', balancesWithMetadata]])
    rawBalancesByChannel = new Map([
      ['asset', balancesWithMetadata.map(bm => bm.balance)],
    ])
    usingMetadata = true
    processNFTs()
  }

  /**
   * Replace balances with metadata across multiple channels in one go.
   * Use this for the multi-channel NFT fan-out (asset + game channels).
   */
  function setBalancesWithMetadataByChannel(
    batches: Array<{ channel: string; balances: TokenBalanceWithMetadata[] }>,
  ): void {
    rawBalancesWithMetadataByChannel = new Map(
      batches.map(({ channel, balances }) => [channel, balances]),
    )
    rawBalancesByChannel = new Map(
      batches.map(({ channel, balances }) => [channel, balances.map(bm => bm.balance)]),
    )
    usingMetadata = true
    processNFTs()
  }

  /**
   * Set the raw allowances for burn authority
   */
  function setAllowances(
    allAllowances: TokenAllowance[],
    burnType: AllowanceType
  ): void {
    rawBurnAllowances = allAllowances.filter(a => a.allowanceType === burnType)

    // Re-process NFTs to update canBurn flags
    processNFTs()
  }

  /**
   * Check if a balance has non-fungible instances (NFT)
   * Cast to any to access instanceIds regardless of TokenBalance variant
   */
  function hasNonFungibleInstances(balance: TokenBalanceAny): boolean {
    const b = balance as { instanceIds?: BigNumber[] }
    if (!b.instanceIds || b.instanceIds.length === 0) return false
    return b.instanceIds.some((id: BigNumber) => {
      const instance = new BigNumber(id?.toString() || '0')
      return !instance.isZero()
    })
  }

  /**
   * Get instance IDs from a balance
   * Cast to any to access instanceIds regardless of TokenBalance variant
   */
  function getInstanceIds(balance: TokenBalanceAny): BigNumber[] {
    const b = balance as { instanceIds?: BigNumber[] }
    return b.instanceIds || []
  }

  /**
   * Process raw balances into display NFTs
   */
  function processNFTs(): void {
    const nftInstances: NFTDisplay[] = []

    if (usingMetadata && rawBalancesWithMetadataByChannel.size > 0) {
      for (const [channel, balances] of rawBalancesWithMetadataByChannel) {
        const nftBalancesWithMetadata = balances.filter(bm => hasNonFungibleInstances(bm.balance))
        for (const bm of nftBalancesWithMetadata) {
          for (const instanceId of getInstanceIds(bm.balance)) {
            const instance = new BigNumber(instanceId?.toString() || '0')
            if (!instance.isZero()) {
              nftInstances.push(toNFTDisplay(bm.balance, instance, rawBurnAllowances, channel, bm.token))
            }
          }
        }
      }
    } else {
      for (const [channel, balances] of rawBalancesByChannel) {
        const nftBalances = balances.filter(b => hasNonFungibleInstances(b))
        for (const balance of nftBalances) {
          for (const instanceId of getInstanceIds(balance)) {
            const instance = new BigNumber(instanceId?.toString() || '0')
            if (!instance.isZero()) {
              nftInstances.push(toNFTDisplay(balance, instance, rawBurnAllowances, channel))
            }
          }
        }
      }
    }

    nfts.value = nftInstances
    collections.value = extractCollections(nftInstances)
    lastFetched.value = Date.now()
  }

  /**
   * Set loading state
   */
  function setLoading(loading: boolean): void {
    isLoading.value = loading
  }

  /**
   * Set error state
   */
  function setError(errorMessage: string | null): void {
    error.value = errorMessage
  }

  /**
   * Update the sort order
   */
  function setSort(option: NFTSortOption): void {
    sortBy.value = option
    currentPage.value = 1
  }

  /**
   * Set collection filter (matches by `collection` field — the first part of
   * the TokenClassKey). Pass null to clear.
   */
  function setCollectionFilter(collection: string | null): void {
    selectedCollection.value = collection
    currentPage.value = 1
  }

  /** Set channel filter (e.g. 'asset', 'mirandus'). Pass null to clear. */
  function setChannelFilter(channel: string | null): void {
    selectedChannel.value = channel
    currentPage.value = 1
  }

  /**
   * Clear collection filter
   */
  function clearFilter(): void {
    selectedCollection.value = null
    selectedChannel.value = null
    currentPage.value = 1
  }

  /** Set the page size and reset to page 1. */
  function setPageSize(size: NFTPageSize): void {
    pageSize.value = size
    currentPage.value = 1
  }

  /** Jump to a specific page (clamped to [1, totalPages]). */
  function setPage(page: number): void {
    const max = totalPages.value
    currentPage.value = Math.min(Math.max(1, page), max)
  }

  /**
   * Clear all NFT data
   */
  function clearNFTs(): void {
    nfts.value = []
    collections.value = []
    selectedCollection.value = null
    selectedChannel.value = null
    currentPage.value = 1
    rawBalancesByChannel = new Map()
    rawBalancesWithMetadataByChannel = new Map()
    rawBurnAllowances = []
    usingMetadata = false
    lastFetched.value = null
    error.value = null
  }

  /**
   * Find an NFT by its key
   */
  function getNFTByKey(instanceKey: string): NFTDisplay | undefined {
    return nfts.value.find(n => n.instanceKey === instanceKey)
  }

  /**
   * Check if data needs refresh (older than 30 seconds)
   */
  function needsRefresh(): boolean {
    if (!lastFetched.value) return true
    return Date.now() - lastFetched.value > 30000
  }

  return {
    // State
    nfts,
    collections,
    selectedCollection,
    selectedChannel,
    isLoading,
    error,
    sortBy,
    lastFetched,
    pageSize,
    currentPage,

    // Getters
    filteredNFTs,
    sortedNFTs,
    pagedNFTs,
    availableChannels,
    hasNFTs,
    totalNFTCount,
    filteredCount,
    totalPages,

    // Actions
    setBalances,
    setBalancesWithMetadata,
    setBalancesWithMetadataByChannel,
    setAllowances,
    setLoading,
    setError,
    setSort,
    setCollectionFilter,
    setChannelFilter,
    clearFilter,
    setPageSize,
    setPage,
    clearNFTs,
    getNFTByKey,
    needsRefresh,
  }
})

// Export types for testing
export type NFTsStore = ReturnType<typeof useNFTsStore>
