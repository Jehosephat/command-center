import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import BigNumber from 'bignumber.js'
import type { TokenBalance } from '@gala-chain/connect'
import type { TokenAllowance, AllowanceType as AllowanceTypeEnum } from '@gala-chain/api'
import type { CollectionDisplay } from '@shared/types/display'

/**
 * Sort options for the collection list
 */
export type CollectionSortOption = 'name-asc' | 'name-desc' | 'minted-desc' | 'minted-asc'

/**
 * Status of a collection in the creation flow
 */
export type CollectionStatus = 'claimed' | 'created'

/**
 * Claimed collection - authorization granted but not yet created
 */
export interface ClaimedCollectionDisplay {
  /** Collection name that was claimed */
  collection: string
  /** Users authorized to create this collection */
  authorizedUsers: string[]
  /** Status in the creation flow */
  status: CollectionStatus
  /** Is the class list expanded in the UI */
  isExpanded: boolean
  /** Token classes within this collection (fetched from chain) */
  classes: CreatorClassDisplay[]
  /** Whether classes have been fetched from chain */
  classesFetched: boolean
}

/**
 * Extended collection display with creator-specific data
 */
export interface CreatorCollectionDisplay extends CollectionDisplay {
  /** Mint allowance remaining for the user */
  mintAllowanceRaw: string
  mintAllowanceFormatted: string
  /** Whether the user has unlimited mint allowance */
  hasUnlimitedMint: boolean
  /** Classes within this collection (to be populated later) */
  classes: CreatorClassDisplay[]
  /** Is the class list expanded in the UI */
  isExpanded: boolean
  /** Status - created collections have this as 'created' */
  status: CollectionStatus
}

/**
 * Display format for a token class within a collection
 */
export interface CreatorClassDisplay {
  /** Unique identifier for the class */
  classKey: string
  /** Collection it belongs to */
  collection: string
  category: string
  type: string
  additionalKey: string
  /** Human-readable class name */
  name: string
  /** Max supply (0 = unlimited) */
  maxSupply: string
  maxSupplyFormatted: string
  /** Current minted count */
  mintedCount: string
  mintedCountFormatted: string
  /** Whether more can be minted */
  canMintMore: boolean
}

/**
 * Format a number for display
 */
function formatNumber(value: BigNumber | string): string {
  const num = new BigNumber(value)
  if (num.isZero()) return '0'
  if (num.isGreaterThanOrEqualTo(1000000)) {
    return num.dividedBy(1000000).toFormat(1) + 'M'
  }
  if (num.isGreaterThanOrEqualTo(1000)) {
    return num.dividedBy(1000).toFormat(1) + 'K'
  }
  return num.toFormat(0)
}

/**
 * Convert a mint allowance to CreatorCollectionDisplay
 */
function toCreatorCollectionDisplay(
  allowance: TokenAllowance,
  balances: TokenBalance[]
): CreatorCollectionDisplay {
  const collectionKey = `${allowance.collection}|${allowance.category}|${allowance.type}|${allowance.additionalKey}`

  // Calculate remaining mint allowance
  const quantity = new BigNumber(allowance.quantity?.toString() || '0')
  const quantitySpent = new BigNumber(allowance.quantitySpent?.toString() || '0')
  const remaining = quantity.minus(quantitySpent)

  // Very large allowance = unlimited
  const UNLIMITED_THRESHOLD = new BigNumber('1e50')
  const hasUnlimitedMint = quantity.isGreaterThanOrEqualTo(UNLIMITED_THRESHOLD)

  // Try to find balance data for this collection to get additional info
  const collectionBalances = balances.filter(b =>
    b.collection === allowance.collection &&
    b.category === allowance.category &&
    b.type === allowance.type &&
    b.additionalKey === allowance.additionalKey
  )

  // Calculate owned count from balances
  let ownedCount = 0
  for (const balance of collectionBalances) {
    if (balance.instanceIds && balance.instanceIds.length > 0) {
      // NFT - count instances
      ownedCount += balance.instanceIds.filter(id => {
        const instance = new BigNumber(id?.toString() || '0')
        return !instance.isZero()
      }).length
    } else {
      // Fungible - count as 1 if has balance
      const qty = new BigNumber(balance.quantity?.toString() || '0')
      if (qty.isGreaterThan(0)) {
        ownedCount++
      }
    }
  }

  return {
    collectionKey,
    collection: allowance.collection,
    category: allowance.category,
    type: allowance.type,
    additionalKey: allowance.additionalKey,
    name: allowance.type || 'Unknown Collection',
    symbol: allowance.type || '???',
    description: '',
    image: '',
    isNonFungible: true, // Assume NFT for creator collections
    maxSupply: '0', // Would need to fetch from token class
    totalSupply: '0', // Would need to fetch from token class
    totalBurned: '0',
    isAuthority: true, // User has mint authority
    ownedCount,
    mintAllowanceRaw: remaining.toString(),
    mintAllowanceFormatted: hasUnlimitedMint ? 'Unlimited' : formatNumber(remaining),
    hasUnlimitedMint,
    classes: [], // To be populated by class management feature
    isExpanded: false,
    status: 'created' as CollectionStatus, // Collections from allowances are created
  }
}

/**
 * Pinia store for managing creator collections state
 */
export const useCreatorCollectionsStore = defineStore('creatorCollections', () => {
  // State
  const collections = ref<CreatorCollectionDisplay[]>([])
  const claimedCollections = ref<ClaimedCollectionDisplay[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const sortBy = ref<CollectionSortOption>('name-asc')
  const lastFetched = ref<number | null>(null)

  // Raw data from API
  let rawMintAllowances: TokenAllowance[] = []
  let rawBalances: TokenBalance[] = []

  // Getters
  const sortedCollections = computed(() => {
    const sorted = [...collections.value]

    switch (sortBy.value) {
      case 'name-asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'name-desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name))
      case 'minted-desc':
        return sorted.sort((a, b) => b.ownedCount - a.ownedCount)
      case 'minted-asc':
        return sorted.sort((a, b) => a.ownedCount - b.ownedCount)
      default:
        return sorted
    }
  })

  const hasCollections = computed(() => collections.value.length > 0)

  const totalCollectionCount = computed(() => collections.value.length)

  const hasClaimedCollections = computed(() => claimedCollections.value.length > 0)

  const pendingClaimedCollections = computed(() => claimedCollections.value)

  // Actions

  /**
   * Set the mint allowances and process into collections
   * Collections are identified by having a Mint allowance with instance 0 (collection-level)
   */
  function setAllowances(allowances: TokenAllowance[], mintType: AllowanceTypeEnum): void {
    // Filter for Mint allowances with instance 0 or undefined (collection-level)
    rawMintAllowances = allowances.filter(a => {
      if (a.allowanceType !== mintType) return false
      // Instance 0 or undefined means collection-level mint authority
      const instance = new BigNumber(a.instance?.toString() || '0')
      return instance.isZero()
    })

    processCollections()
  }

  /**
   * Set the balances for enriching collection data
   */
  function setBalances(balances: TokenBalance[]): void {
    rawBalances = balances
    processCollections()
  }

  /**
   * Process raw allowances into display collections
   */
  function processCollections(): void {
    // Create unique collections from mint allowances
    const collectionMap = new Map<string, CreatorCollectionDisplay>()

    for (const allowance of rawMintAllowances) {
      const collectionKey = `${allowance.collection}|${allowance.category}|${allowance.type}|${allowance.additionalKey}`

      if (!collectionMap.has(collectionKey)) {
        collectionMap.set(collectionKey, toCreatorCollectionDisplay(allowance, rawBalances))
      }
    }

    collections.value = Array.from(collectionMap.values())
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
  function setSort(option: CollectionSortOption): void {
    sortBy.value = option
  }

  /**
   * Toggle expansion state of a collection
   */
  function toggleExpanded(collectionKey: string): void {
    const collection = collections.value.find(c => c.collectionKey === collectionKey)
    if (collection) {
      collection.isExpanded = !collection.isExpanded
    }
  }

  /**
   * Set claimed collections from NFT collection authorizations
   */
  function setClaimedCollections(claimed: Array<{ collection: string; authorizedUsers: string[] }>): void {
    // Filter out collections that are already created (have mint allowances)
    const createdCollectionNames = new Set(collections.value.map(c => c.collection))

    // Preserve expansion/class state for existing entries
    const existingMap = new Map(claimedCollections.value.map(c => [c.collection, c]))

    claimedCollections.value = claimed.map(c => {
      const existing = existingMap.get(c.collection)
      return {
        collection: c.collection,
        authorizedUsers: c.authorizedUsers,
        status: createdCollectionNames.has(c.collection) ? 'created' as CollectionStatus : 'claimed' as CollectionStatus,
        isExpanded: existing?.isExpanded ?? false,
        classes: existing?.classes ?? [],
        classesFetched: existing?.classesFetched ?? false,
      }
    })
  }

  /**
   * Add a newly claimed collection
   */
  function addClaimedCollection(collection: string, authorizedUser: string): void {
    // Check if already exists
    const existing = claimedCollections.value.find(c => c.collection === collection)
    if (existing) {
      if (!existing.authorizedUsers.includes(authorizedUser)) {
        existing.authorizedUsers.push(authorizedUser)
      }
      return
    }

    claimedCollections.value.push({
      collection,
      authorizedUsers: [authorizedUser],
      status: 'claimed',
      isExpanded: false,
      classes: [],
      classesFetched: false,
    })
  }

  /**
   * Mark a claimed collection as created
   */
  function markCollectionCreated(collection: string): void {
    const claimed = claimedCollections.value.find(c => c.collection === collection)
    if (claimed) {
      claimed.status = 'created'
    }
  }

  /**
   * Toggle expansion state of a pending/claimed collection
   */
  function togglePendingExpanded(collectionName: string): void {
    const claimed = claimedCollections.value.find(c => c.collection === collectionName)
    if (claimed) {
      claimed.isExpanded = !claimed.isExpanded
    }
  }

  /**
   * Set fetched classes for a collection (works for both created and pending collections)
   */
  function setClassesForCollection(collectionName: string, classes: CreatorClassDisplay[]): void {
    // Update created collections
    for (const col of collections.value) {
      if (col.collection === collectionName) {
        col.classes = classes
      }
    }
    // Update claimed/pending collections
    const claimed = claimedCollections.value.find(c => c.collection === collectionName)
    if (claimed) {
      claimed.classes = classes
      claimed.classesFetched = true
    }
  }

  /**
   * Clear all collection data
   */
  function clearCollections(): void {
    collections.value = []
    claimedCollections.value = []
    rawMintAllowances = []
    rawBalances = []
    lastFetched.value = null
    error.value = null
  }

  /**
   * Find a collection by its key
   */
  function getCollectionByKey(collectionKey: string): CreatorCollectionDisplay | undefined {
    return collections.value.find(c => c.collectionKey === collectionKey)
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
    collections,
    claimedCollections,
    isLoading,
    error,
    sortBy,
    lastFetched,

    // Getters
    sortedCollections,
    hasCollections,
    totalCollectionCount,
    hasClaimedCollections,
    pendingClaimedCollections,

    // Actions
    setAllowances,
    setBalances,
    setClaimedCollections,
    addClaimedCollection,
    markCollectionCreated,
    setLoading,
    setError,
    setSort,
    toggleExpanded,
    togglePendingExpanded,
    setClassesForCollection,
    clearCollections,
    getCollectionByKey,
    needsRefresh,
  }
})

// Export types for testing
export type CreatorCollectionsStore = ReturnType<typeof useCreatorCollectionsStore>
