/**
 * Composable for NFT collection authorization management
 *
 * This handles the new two-step NFT collection creation flow:
 * 1. Claim a collection name (GrantNftCollectionAuthorization)
 * 2. Create the collection (CreateNftCollection)
 */

import { ref, computed } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useCreatorCollectionsStore } from '@/stores/creatorCollections'
import {
  fetchNftCollectionAuthorizations,
  grantNftCollectionAuthorization,
  createNftCollection,
  type NftCollectionAuthorization,
  type CreateNftCollectionInput,
} from '@/lib/galachainClient'
import type { TokenClass } from '@gala-chain/connect'

/**
 * Claimed collection - a collection name that has been claimed but not yet created
 */
export interface ClaimedCollection {
  collection: string
  authorizedUsers: string[]
  isCreated: boolean
}

/**
 * Result of an operation
 */
export interface OperationResult<T> {
  success: boolean
  data?: T
  error?: string
}

// Shared state across all composable instances (singleton pattern)
const isLoading = ref(false)
const isClaiming = ref(false)
const isCreating = ref(false)
const error = ref<string | null>(null)
const claimedCollections = ref<ClaimedCollection[]>([])

export function useNftCollectionAuth() {
  const walletStore = useWalletStore()
  const collectionsStore = useCreatorCollectionsStore()

  // Computed
  const isConnected = computed(() => walletStore.connected)
  const walletAddress = computed(() => walletStore.address)

  /**
   * Clear error state
   */
  function clearError() {
    error.value = null
  }

  /**
   * Fetch all NFT collection authorizations for the current user
   * Returns claimed collection names that can be used to create collections
   */
  async function fetchAuthorizations(): Promise<OperationResult<NftCollectionAuthorization[]>> {
    if (!walletStore.connected || !walletStore.address) {
      return { success: false, error: 'Wallet not connected' }
    }

    isLoading.value = true
    error.value = null

    try {
      const results: NftCollectionAuthorization[] = []
      let bookmark: string | undefined

      // Paginate through all results
      const userAddressLower = walletStore.address!.toLowerCase()

      do {
        const response = await fetchNftCollectionAuthorizations({ bookmark, limit: 100 })

        // Filter to only include authorizations for the current user (case-insensitive)
        const userAuths = response.results.filter(auth =>
          auth.authorizedUsers?.some(user => user.toLowerCase() === userAddressLower)
        )

        results.push(...userAuths)
        bookmark = response.nextPageBookmark
      } while (bookmark)

      // Update claimed collections
      claimedCollections.value = results.map(auth => ({
        collection: auth.collection,
        authorizedUsers: auth.authorizedUsers,
        isCreated: false, // Will be updated when we check existing collections
      }))

      // Sync into the Pinia store (which has expansion/class state)
      collectionsStore.setClaimedCollections(results)

      return { success: true, data: results }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch authorizations'
      error.value = message
      return { success: false, error: message }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Claim a collection name (Step 1 of NFT collection creation)
   * This grants the user authorization to create a collection with this name
   */
  async function claimCollectionName(collectionName: string): Promise<OperationResult<void>> {
    if (!walletStore.connected || !walletStore.address) {
      return { success: false, error: 'Wallet not connected' }
    }

    isClaiming.value = true
    error.value = null

    try {
      const client = await walletStore.getClient()
      if (!client) {
        return { success: false, error: 'Unable to get wallet client' }
      }

      // Grant authorization to self
      await grantNftCollectionAuthorization(client, collectionName, walletStore.address)

      // Add to claimed collections
      claimedCollections.value.push({
        collection: collectionName,
        authorizedUsers: [walletStore.address],
        isCreated: false,
      })

      return { success: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to claim collection name'
      error.value = message
      return { success: false, error: message }
    } finally {
      isClaiming.value = false
    }
  }

  /**
   * Create an NFT collection from a claimed authorization (Step 2)
   * The collection name must have been previously claimed via claimCollectionName
   */
  async function createCollection(input: CreateNftCollectionInput): Promise<OperationResult<TokenClass>> {
    if (!walletStore.connected) {
      return { success: false, error: 'Wallet not connected' }
    }

    isCreating.value = true
    error.value = null

    try {
      const client = await walletStore.getClient()
      if (!client) {
        return { success: false, error: 'Unable to get wallet client' }
      }

      const tokenClass = await createNftCollection(client, input)

      // Mark as created in claimed collections
      const claimedIndex = claimedCollections.value.findIndex(c => c.collection === input.collection)
      if (claimedIndex >= 0) {
        claimedCollections.value[claimedIndex].isCreated = true
      }

      return { success: true, data: tokenClass }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create collection'
      error.value = message
      return { success: false, error: message }
    } finally {
      isCreating.value = false
    }
  }

  /**
   * Check if a collection name has been claimed
   */
  function isCollectionClaimed(collectionName: string): boolean {
    return claimedCollections.value.some(c => c.collection === collectionName)
  }

  /**
   * Check if a claimed collection has been created
   */
  function isCollectionCreated(collectionName: string): boolean {
    const claimed = claimedCollections.value.find(c => c.collection === collectionName)
    return claimed?.isCreated ?? false
  }

  /**
   * Get claimed collections that haven't been created yet
   */
  const pendingCollections = computed(() =>
    claimedCollections.value.filter(c => !c.isCreated)
  )

  /**
   * Get the full two-step collection creation flow
   * Returns a helper object for managing the claim-then-create flow
   */
  function useCollectionCreationFlow() {
    const step = ref<'claim' | 'create'>('claim')
    const claimedName = ref<string | null>(null)

    async function claimAndProceed(collectionName: string) {
      const result = await claimCollectionName(collectionName)
      if (result.success) {
        claimedName.value = collectionName
        step.value = 'create'
      }
      return result
    }

    async function createFromClaim(input: Omit<CreateNftCollectionInput, 'collection'>) {
      if (!claimedName.value) {
        return { success: false, error: 'No collection name claimed' }
      }
      return createCollection({ ...input, collection: claimedName.value })
    }

    function reset() {
      step.value = 'claim'
      claimedName.value = null
    }

    return {
      step,
      claimedName,
      claimAndProceed,
      createFromClaim,
      reset,
    }
  }

  return {
    // State
    isLoading,
    isClaiming,
    isCreating,
    error,
    claimedCollections,

    // Computed
    isConnected,
    walletAddress,
    pendingCollections,

    // Actions
    clearError,
    fetchAuthorizations,
    claimCollectionName,
    createCollection,
    isCollectionClaimed,
    isCollectionCreated,
    useCollectionCreationFlow,
  }
}
