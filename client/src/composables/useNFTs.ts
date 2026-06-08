/**
 * Composable for fetching and managing NFTs
 *
 * Provides reactive access to NFTs and their collections.
 * Integrates with the NFTs store and GalaChain client.
 */

import { computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { AllowanceType } from '@gala-chain/api'
import { useNFTsStore, type NFTSortOption, type NFTPageSize } from '@/stores/nfts'
import { useWalletStore } from '@/stores/wallet'
import { useNetworkStore } from '@/stores/network'
import { useGalaChain } from '@/composables/useGalaChain'

/**
 * Composable for NFT operations
 */
export function useNFTs() {
  const nftsStore = useNFTsStore()
  const walletStore = useWalletStore()
  const networkStore = useNetworkStore()
  const galaChain = useGalaChain()
  const router = useRouter()
  const route = useRoute()

  // Computed properties from store
  // `nfts` exposes the paged slice — the view renders this directly.
  const nfts = computed(() => nftsStore.pagedNFTs)
  const allFilteredNFTs = computed(() => nftsStore.sortedNFTs)
  const collections = computed(() => nftsStore.collections)
  const channels = computed(() => nftsStore.availableChannels)
  const selectedCollection = computed(() => nftsStore.selectedCollection)
  const selectedChannel = computed(() => nftsStore.selectedChannel)
  const isLoading = computed(() => nftsStore.isLoading)
  const error = computed(() => nftsStore.error)
  const sortBy = computed(() => nftsStore.sortBy)
  const hasNFTs = computed(() => nftsStore.hasNFTs)
  const totalNFTCount = computed(() => nftsStore.totalNFTCount)
  const filteredCount = computed(() => nftsStore.filteredCount)
  const pageSize = computed(() => nftsStore.pageSize)
  const currentPage = computed(() => nftsStore.currentPage)
  const totalPages = computed(() => nftsStore.totalPages)

  // Wallet connection state
  const isConnected = computed(() => walletStore.connected)
  const walletAddress = computed(() => walletStore.address)

  /**
   * Fetch NFT balances from GalaChain with metadata (name, symbol, image, etc.)
   * Fans out to every NFT channel concurrently and tags each balance batch with its channel.
   * Channels that fail are logged and skipped — partial results still render.
   */
  async function fetchNFTs(): Promise<void> {
    if (!walletStore.connected || !walletStore.address) {
      return
    }

    nftsStore.setLoading(true)
    nftsStore.setError(null)

    try {
      const owner = walletStore.address!
      const channels = networkStore.nftChannelUrls

      const results = await Promise.all(
        channels.map(async ({ channel, url }) => {
          const result = await galaChain.getBalancesWithMetadata(owner, undefined, url)
          if (!result.success) {
            console.warn(`[NFTs] Failed to fetch from channel "${channel}":`, result.error)
            return { channel, balances: [] }
          }
          return { channel, balances: result.data }
        }),
      )

      nftsStore.setBalancesWithMetadataByChannel(results)
    } catch (err) {
      nftsStore.setError(
        err instanceof Error ? err.message : 'Failed to fetch NFTs'
      )
    } finally {
      nftsStore.setLoading(false)
    }
  }

  /**
   * Fetch allowances from GalaChain (for burn authority)
   */
  async function fetchAllowances(): Promise<void> {
    if (!walletStore.connected || !walletStore.address) {
      return
    }

    try {
      const result = await galaChain.getAllowances(walletStore.address!)

      if (result.success) {
        nftsStore.setAllowances(
          result.data,
          AllowanceType.Burn
        )
      }
    } catch {
      // Silently fail for allowances - they're supplementary data
      console.warn('Failed to fetch allowances for NFTs')
    }
  }

  /**
   * Fetch both NFTs and allowances
   */
  async function fetchAll(): Promise<void> {
    await Promise.all([fetchNFTs(), fetchAllowances()])
  }

  /**
   * Refresh NFT data if needed
   */
  async function refresh(force: boolean = false): Promise<void> {
    if (force || nftsStore.needsRefresh()) {
      await fetchAll()
    }
  }

  /**
   * Update sort order
   */
  function setSort(option: NFTSortOption): void {
    nftsStore.setSort(option)
  }

  /**
   * Set collection filter and sync with URL
   */
  function setCollectionFilter(collection: string | null): void {
    nftsStore.setCollectionFilter(collection)

    if (collection) {
      router.push({ query: { ...route.query, collection } })
    } else {
      const { collection: _, ...rest } = route.query
      router.push({ query: rest })
    }
  }

  /** Set channel filter and sync with URL */
  function setChannelFilter(channel: string | null): void {
    nftsStore.setChannelFilter(channel)

    if (channel) {
      router.push({ query: { ...route.query, channel } })
    } else {
      const { channel: _, ...rest } = route.query
      router.push({ query: rest })
    }
  }

  /**
   * Clear all filters (collection + channel)
   */
  function clearFilter(): void {
    nftsStore.clearFilter()
    const { collection: _c, channel: _ch, ...rest } = route.query
    router.push({ query: rest })
  }

  function setPageSize(size: NFTPageSize): void {
    nftsStore.setPageSize(size)
  }

  function setPage(page: number): void {
    nftsStore.setPage(page)
  }

  /**
   * Get an NFT by its key
   */
  function getNFT(instanceKey: string) {
    return nftsStore.getNFTByKey(instanceKey)
  }

  /**
   * Clear all NFT data (called on disconnect)
   */
  function clearNFTs(): void {
    nftsStore.clearNFTs()
  }

  // Watch for wallet connection changes
  watch(
    () => walletStore.connected,
    (connected) => {
      if (connected) {
        // Fetch NFTs when wallet connects
        fetchAll()
      } else {
        // Clear NFTs when wallet disconnects
        clearNFTs()
      }
    },
    { immediate: false }
  )

  // Watch for wallet address changes (account switch)
  watch(
    () => walletStore.address,
    (newAddress, oldAddress) => {
      if (newAddress && newAddress !== oldAddress) {
        // Refetch NFTs when address changes
        fetchAll()
      }
    }
  )

  // Sync URL collection param to store on mount
  watch(
    () => route.query.collection,
    (collectionParam) => {
      const collection = collectionParam as string | undefined
      if (collection !== nftsStore.selectedCollection) {
        nftsStore.setCollectionFilter(collection || null)
      }
    },
    { immediate: true }
  )

  // Sync URL channel param to store on mount
  watch(
    () => route.query.channel,
    (channelParam) => {
      const channel = channelParam as string | undefined
      if (channel !== nftsStore.selectedChannel) {
        nftsStore.setChannelFilter(channel || null)
      }
    },
    { immediate: true }
  )

  return {
    // State from store
    nfts,
    allFilteredNFTs,
    collections,
    channels,
    selectedCollection,
    selectedChannel,
    isLoading,
    error,
    sortBy,
    hasNFTs,
    totalNFTCount,
    filteredCount,
    pageSize,
    currentPage,
    totalPages,

    // Wallet state
    isConnected,
    walletAddress,

    // Actions
    fetchNFTs,
    fetchAllowances,
    fetchAll,
    refresh,
    setSort,
    setCollectionFilter,
    setChannelFilter,
    clearFilter,
    setPageSize,
    setPage,
    getNFT,
    clearNFTs,
  }
}

// Export type for use in components
export type UseNFTs = ReturnType<typeof useNFTs>
