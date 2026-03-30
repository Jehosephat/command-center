/**
 * Composable for minting from creator collections
 *
 * Provides a reactive interface for minting NFTs from owned collections
 * with integrated wallet signing and error handling.
 */

import { ref, computed } from 'vue'
import { useGalaChain } from '@/composables/useGalaChain'
import { useWalletStore } from '@/stores/wallet'
import type { CreatorCollectionDisplay, CreatorClassDisplay } from '@/stores/creatorCollections'
import BigNumber from 'bignumber.js'

export interface CollectionMintResult {
  success: boolean
  /** Array of minted token instance keys */
  mintedInstances?: string[]
  error?: string
}

/**
 * Token class key structure for mint operations
 */
export interface MintTokenClassKey {
  collection: string
  category: string
  type: string
  additionalKey: string
}

/**
 * Composable for minting from creator collections
 */
export function useCollectionMint() {
  const { mintToken, isLoading: galaChainLoading, error: galaChainError } = useGalaChain()
  const walletStore = useWalletStore()

  // Local state for mint operation
  const isMinting = ref(false)
  const mintError = ref<string | null>(null)

  // Computed: combined loading state
  const isLoading = computed(() => isMinting.value || galaChainLoading.value)

  // Computed: combined error state
  const error = computed(() => mintError.value || galaChainError.value)

  // Computed: whether the wallet is connected
  const isConnected = computed(() => walletStore.connected)

  // Computed: current wallet address (recipient of minted NFTs)
  const ownerAddress = computed(() => walletStore.address || '')

  /**
   * Clear the error state
   */
  function clearError() {
    mintError.value = null
  }

  /**
   * Build a TokenClassKey from a CreatorCollectionDisplay
   */
  function buildTokenClassKeyFromCollection(collection: CreatorCollectionDisplay): MintTokenClassKey {
    return {
      collection: collection.collection,
      category: collection.category,
      type: collection.type,
      additionalKey: collection.additionalKey,
    }
  }

  /**
   * Build a TokenClassKey from a CreatorClassDisplay
   */
  function buildTokenClassKeyFromClass(classItem: CreatorClassDisplay): MintTokenClassKey {
    return {
      collection: classItem.collection,
      category: classItem.category,
      type: classItem.type,
      additionalKey: classItem.additionalKey,
    }
  }

  /**
   * Get the maximum mintable quantity for a collection
   * Returns the minimum of remaining allowance and an optional cap
   */
  function getMaxMintableQuantity(collection: CreatorCollectionDisplay): number {
    const remaining = new BigNumber(collection.mintAllowanceRaw)

    if (remaining.isGreaterThan(Number.MAX_SAFE_INTEGER)) {
      return Number.MAX_SAFE_INTEGER
    }

    return remaining.toNumber()
  }

  /**
   * Get the maximum mintable quantity for a class
   * Returns the remaining supply (maxSupply - minted), or MAX_SAFE_INTEGER if unlimited
   */
  function getMaxMintableQuantityForClass(classItem: CreatorClassDisplay): number {
    const maxSupply = new BigNumber(classItem.maxSupply || '0')
    if (maxSupply.isZero()) {
      return Number.MAX_SAFE_INTEGER // Unlimited
    }

    const minted = new BigNumber(classItem.mintedCount || '0')
    const remaining = maxSupply.minus(minted)

    return Math.max(0, remaining.toNumber())
  }

  /**
   * Validate mint quantity
   * Returns error message if invalid, null if valid
   */
  function validateMintQuantity(
    quantity: string,
    maxAllowance: string,
    maxSupply?: string
  ): string | null {
    // Check if quantity is a valid positive integer
    const quantityNum = parseInt(quantity, 10)
    if (isNaN(quantityNum) || quantityNum <= 0 || !Number.isInteger(quantityNum)) {
      return 'Quantity must be a positive whole number.'
    }

    // Check string matches parsed number (reject "3.5" which parses to 3)
    if (quantity !== quantityNum.toString()) {
      return 'Quantity must be a whole number (NFTs cannot be fractional).'
    }

    // Check against mint allowance
    const allowance = new BigNumber(maxAllowance)
    if (new BigNumber(quantityNum).isGreaterThan(allowance)) {
      return `Quantity exceeds your mint allowance of ${allowance.toFormat(0)}.`
    }

    // Check against max supply if provided and not zero (unlimited)
    if (maxSupply && maxSupply !== '0') {
      const supply = new BigNumber(maxSupply)
      if (new BigNumber(quantityNum).isGreaterThan(supply)) {
        return `Quantity exceeds remaining supply of ${supply.toFormat(0)}.`
      }
    }

    return null
  }

  /**
   * Execute a mint operation from a collection
   *
   * @param collection - The collection to mint from
   * @param quantity - The number of NFTs to mint (as string)
   * @param recipient - Optional recipient address (defaults to connected wallet)
   * @returns CollectionMintResult indicating success or failure
   */
  async function executeMintFromCollection(
    collection: CreatorCollectionDisplay,
    quantity: string,
    recipient?: string
  ): Promise<CollectionMintResult> {
    clearError()
    isMinting.value = true

    try {
      // Validate wallet connection
      if (!walletStore.connected || !walletStore.address) {
        mintError.value = 'Wallet not connected. Please connect your wallet first.'
        return { success: false, error: mintError.value }
      }

      // Validate quantity
      const validationError = validateMintQuantity(quantity, collection.mintAllowanceRaw)
      if (validationError) {
        mintError.value = validationError
        return { success: false, error: mintError.value }
      }

      // Build token class key for mint
      const tokenClassKey = buildTokenClassKeyFromCollection(collection)

      // Use specified recipient or default to connected wallet
      const mintRecipient = recipient || walletStore.address

      // Execute the mint via GalaChain
      const result = await mintToken(tokenClassKey, quantity, mintRecipient)

      if (result.success) {
        // Extract minted instance keys from result
        const mintedInstances = result.data?.map((instance: unknown) => {
          if (typeof instance === 'object' && instance !== null) {
            const key = instance as {
              collection?: string
              category?: string
              type?: string
              additionalKey?: string
              instance?: { toString(): string }
            }
            return `${key.collection}|${key.category}|${key.type}|${key.additionalKey}|${key.instance?.toString()}`
          }
          return String(instance)
        })

        return { success: true, mintedInstances }
      } else {
        mintError.value = result.error || 'Mint failed'
        return { success: false, error: mintError.value }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      mintError.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      isMinting.value = false
    }
  }

  /**
   * Execute a mint operation from a specific class within a collection
   *
   * @param classItem - The class to mint from
   * @param quantity - The number of NFTs to mint (as string)
   * @param collection - The parent collection (for allowance validation)
   * @param recipient - Optional recipient address (defaults to connected wallet)
   * @returns CollectionMintResult indicating success or failure
   */
  async function executeMintFromClass(
    classItem: CreatorClassDisplay,
    quantity: string,
    collection: CreatorCollectionDisplay,
    recipient?: string
  ): Promise<CollectionMintResult> {
    clearError()
    isMinting.value = true

    try {
      // Validate wallet connection
      if (!walletStore.connected || !walletStore.address) {
        mintError.value = 'Wallet not connected. Please connect your wallet first.'
        return { success: false, error: mintError.value }
      }

      // Calculate remaining supply for this class
      const maxSupply = new BigNumber(classItem.maxSupply || '0')
      let remainingSupply: string | undefined
      if (!maxSupply.isZero()) {
        const minted = new BigNumber(classItem.mintedCount || '0')
        remainingSupply = maxSupply.minus(minted).toString()
      }

      // Validate quantity against both allowance and supply
      const validationError = validateMintQuantity(
        quantity,
        collection.mintAllowanceRaw,
        remainingSupply
      )
      if (validationError) {
        mintError.value = validationError
        return { success: false, error: mintError.value }
      }

      // Check if class can mint more
      if (!classItem.canMintMore) {
        mintError.value = 'This class has reached its maximum supply.'
        return { success: false, error: mintError.value }
      }

      // Build token class key for mint (uses class's additionalKey, not collection's)
      const tokenClassKey = buildTokenClassKeyFromClass(classItem)

      // Use specified recipient or default to connected wallet
      const mintRecipient = recipient || walletStore.address

      // Execute the mint via GalaChain
      const result = await mintToken(tokenClassKey, quantity, mintRecipient)

      if (result.success) {
        // Extract minted instance keys from result
        const mintedInstances = result.data?.map((instance: unknown) => {
          if (typeof instance === 'object' && instance !== null) {
            const key = instance as {
              collection?: string
              category?: string
              type?: string
              additionalKey?: string
              instance?: { toString(): string }
            }
            return `${key.collection}|${key.category}|${key.type}|${key.additionalKey}|${key.instance?.toString()}`
          }
          return String(instance)
        })

        return { success: true, mintedInstances }
      } else {
        mintError.value = result.error || 'Mint failed'
        return { success: false, error: mintError.value }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      mintError.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      isMinting.value = false
    }
  }

  return {
    // State
    isLoading,
    isMinting,
    error,
    mintError,
    isConnected,
    ownerAddress,

    // Actions
    executeMintFromCollection,
    executeMintFromClass,
    clearError,
    buildTokenClassKeyFromCollection,
    buildTokenClassKeyFromClass,
    getMaxMintableQuantity,
    getMaxMintableQuantityForClass,
    validateMintQuantity,
  }
}

export type UseCollectionMint = ReturnType<typeof useCollectionMint>
