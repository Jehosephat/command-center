/**
 * Composable for fetching and managing creator collections
 *
 * Provides reactive access to collections where the connected wallet has authority.
 * Integrates with the creatorCollections store and GalaChain client.
 */

import { computed, watch } from 'vue'
import { AllowanceType } from '@gala-chain/api'
import type { TokenBalance } from '@gala-chain/connect'
import BigNumber from 'bignumber.js'
import { useCreatorCollectionsStore, type CollectionSortOption, type CreatorClassDisplay } from '@/stores/creatorCollections'
import { useWalletStore } from '@/stores/wallet'
import { useGalaChain } from '@/composables/useGalaChain'
import { fetchTokenClasses } from '@/lib/galachainClient'

/**
 * Composable for creator collection operations
 */
function formatBigNumber(value: BigNumber): string {
  if (value.isZero()) return '0'
  if (value.isGreaterThanOrEqualTo(1_000_000)) return value.dividedBy(1_000_000).toFormat(1) + 'M'
  if (value.isGreaterThanOrEqualTo(1_000)) return value.dividedBy(1_000).toFormat(1) + 'K'
  return value.toFormat(0)
}

export function useCreatorCollections() {
  const collectionsStore = useCreatorCollectionsStore()
  const walletStore = useWalletStore()
  const galaChain = useGalaChain()

  // Computed properties from store
  const collections = computed(() => collectionsStore.sortedCollections)
  const isLoading = computed(() => collectionsStore.isLoading)
  const error = computed(() => collectionsStore.error)
  const sortBy = computed(() => collectionsStore.sortBy)
  const hasCollections = computed(() => collectionsStore.hasCollections)
  const totalCollectionCount = computed(() => collectionsStore.totalCollectionCount)

  // Wallet connection state
  const isConnected = computed(() => walletStore.connected)
  const walletAddress = computed(() => walletStore.address)

  /**
   * Fetch collections where the connected wallet has authority
   * Authority is determined by having a Mint allowance for instance 0 (collection-level)
   */
  async function fetchCollections(): Promise<void> {
    if (!walletStore.connected || !walletStore.address) {
      return
    }

    collectionsStore.setLoading(true)
    collectionsStore.setError(null)

    try {
      // Fetch allowances to find collections where user has mint authority
      const allowancesResult = await galaChain.getAllowances(walletStore.address!)

      if (allowancesResult.success) {
        collectionsStore.setAllowances(allowancesResult.data, AllowanceType.Mint)
      } else {
        collectionsStore.setError(allowancesResult.error)
        return
      }

      // Also fetch balances to enrich collection data with owned counts
      const balancesResult = await galaChain.getBalances(walletStore.address!)

      if (balancesResult.success) {
        collectionsStore.setBalances(balancesResult.data as unknown as TokenBalance[])
      }
      // Note: We don't fail if balances fail - they're supplementary
    } catch (err) {
      collectionsStore.setError(
        err instanceof Error ? err.message : 'Failed to fetch collections'
      )
    } finally {
      collectionsStore.setLoading(false)
    }
  }

  /**
   * Refresh collection data
   */
  async function refresh(force: boolean = false): Promise<void> {
    if (force || collectionsStore.needsRefresh()) {
      await fetchCollections()
    }
  }

  /**
   * Update sort order
   */
  function setSort(option: CollectionSortOption): void {
    collectionsStore.setSort(option)
  }

  /**
   * Toggle collection expansion
   */
  function toggleExpanded(collectionKey: string): void {
    collectionsStore.toggleExpanded(collectionKey)
  }

  /**
   * Get a collection by its key
   */
  function getCollection(collectionKey: string) {
    return collectionsStore.getCollectionByKey(collectionKey)
  }

  /**
   * Fetch token classes for a collection from the chain and populate the store
   */
  async function fetchClassesForCollection(collectionName: string): Promise<void> {
    try {
      const allClasses: CreatorClassDisplay[] = []
      let bookmark: string | undefined

      do {
        const response = await fetchTokenClasses(
          { collection: collectionName },
          { bookmark, limit: 100 }
        )

        for (const tc of response.results) {
          const maxSupply = new BigNumber(tc.maxSupply?.toString() || '0')
          const totalMinted = new BigNumber(tc.knownMintSupply?.toString() || tc.totalSupply?.toString() || '0')
          const classKey = `${tc.collection}|${tc.category}|${tc.type}|${tc.additionalKey}`

          allClasses.push({
            classKey,
            collection: tc.collection,
            category: tc.category,
            type: tc.type,
            additionalKey: tc.additionalKey,
            name: tc.name || tc.type || 'Unnamed',
            maxSupply: maxSupply.toString(),
            maxSupplyFormatted: maxSupply.isZero() ? 'Unlimited' : formatBigNumber(maxSupply),
            mintedCount: totalMinted.toString(),
            mintedCountFormatted: formatBigNumber(totalMinted),
            canMintMore: maxSupply.isZero() || totalMinted.isLessThan(maxSupply),
          })
        }

        bookmark = response.nextPageBookmark || undefined
      } while (bookmark)

      collectionsStore.setClassesForCollection(collectionName, allClasses)
    } catch (err) {
      console.error(`[useCreatorCollections] Failed to fetch classes for ${collectionName}:`, err)
    }
  }

  /**
   * Toggle expansion of a pending/claimed collection, fetching classes on first expand
   */
  async function togglePendingExpanded(collectionName: string): Promise<void> {
    collectionsStore.togglePendingExpanded(collectionName)

    // If we just expanded and haven't fetched classes yet, fetch them
    const claimed = collectionsStore.claimedCollections.find(c => c.collection === collectionName)
    if (claimed?.isExpanded && !claimed.classesFetched) {
      await fetchClassesForCollection(collectionName)
    }
  }

  /**
   * Clear all collection data (called on disconnect)
   */
  function clearCollections(): void {
    collectionsStore.clearCollections()
  }

  // Watch for wallet connection changes
  watch(
    () => walletStore.connected,
    (connected) => {
      if (connected) {
        // Fetch collections when wallet connects
        fetchCollections()
      } else {
        // Clear collections when wallet disconnects
        clearCollections()
      }
    },
    { immediate: false }
  )

  // Watch for wallet address changes (account switch)
  watch(
    () => walletStore.address,
    (newAddress, oldAddress) => {
      if (newAddress && newAddress !== oldAddress) {
        // Refetch collections when address changes
        fetchCollections()
      }
    }
  )

  return {
    // State from store
    collections,
    isLoading,
    error,
    sortBy,
    hasCollections,
    totalCollectionCount,

    // Wallet state
    isConnected,
    walletAddress,

    // Actions
    fetchCollections,
    refresh,
    setSort,
    toggleExpanded,
    togglePendingExpanded,
    fetchClassesForCollection,
    getCollection,
    clearCollections,
  }
}

// Export type for use in components
export type UseCreatorCollections = ReturnType<typeof useCreatorCollections>
