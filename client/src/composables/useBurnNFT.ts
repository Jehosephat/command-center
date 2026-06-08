/**
 * Composable for NFT burn operations
 *
 * Provides a reactive interface for burning NFTs
 * with integrated wallet signing and error handling.
 */

import { ref, computed } from 'vue'
import { useGalaChain } from '@/composables/useGalaChain'
import { useWalletStore } from '@/stores/wallet'
import { useNetworkStore } from '@/stores/network'
import type { NFTDisplay } from '@shared/types/display'
import type { TokenInstanceInput } from '@/lib/galachainClient'

export interface BurnNFTResult {
  success: boolean
  error?: string
}

/**
 * Composable for burning NFTs
 */
export function useBurnNFT() {
  const { burnTokens, isLoading: galaChainLoading, error: galaChainError } = useGalaChain()
  const walletStore = useWalletStore()
  const networkStore = useNetworkStore()

  // Local state for burn operation
  const isBurning = ref(false)
  const burnError = ref<string | null>(null)

  // Computed: combined loading state
  const isLoading = computed(() => isBurning.value || galaChainLoading.value)

  // Computed: combined error state
  const error = computed(() => burnError.value || galaChainError.value)

  // Computed: whether the wallet is connected
  const isConnected = computed(() => walletStore.connected)

  // Computed: current wallet address (owner of NFT being burned)
  const ownerAddress = computed(() => walletStore.address || '')

  /**
   * Clear the error state
   */
  function clearError() {
    burnError.value = null
  }

  /**
   * Build a TokenInstanceInput from an NFTDisplay
   * Uses the specific NFT instance ID
   */
  function buildTokenInstance(nft: NFTDisplay): TokenInstanceInput {
    return {
      collection: nft.collection,
      category: nft.category,
      type: nft.type,
      additionalKey: nft.additionalKey,
      instance: nft.instance, // Use the specific NFT instance ID
    }
  }

  /**
   * Check if an NFT can be burned
   * - Must have burn authority (canBurn flag)
   * - Must not be locked
   * - Must not be in use
   */
  function canBurnNFT(nft: NFTDisplay): { canBurn: boolean; reason?: string } {
    if (!nft.canBurn) {
      return { canBurn: false, reason: 'You do not have burn authority for this NFT.' }
    }
    if (nft.isLocked) {
      return { canBurn: false, reason: 'This NFT is currently locked and cannot be burned.' }
    }
    if (nft.isInUse) {
      return { canBurn: false, reason: 'This NFT is currently in use and cannot be burned.' }
    }
    return { canBurn: true }
  }

  /**
   * Execute an NFT burn operation
   *
   * @param nft - The NFT to burn
   * @returns BurnNFTResult indicating success or failure
   */
  async function executeBurn(nft: NFTDisplay): Promise<BurnNFTResult> {
    clearError()
    isBurning.value = true

    try {
      // Validate wallet connection
      if (!walletStore.connected || !walletStore.address) {
        burnError.value = 'Wallet not connected. Please connect your wallet first.'
        return { success: false, error: burnError.value }
      }

      // Validate NFT can be burned
      const burnCheck = canBurnNFT(nft)
      if (!burnCheck.canBurn) {
        burnError.value = burnCheck.reason || 'Cannot burn this NFT.'
        return { success: false, error: burnError.value }
      }

      // Build token instance for burn
      const tokenInstance = buildTokenInstance(nft)

      // Route the burn through the NFT's source channel
      const gatewayUrl = networkStore.tokenContractUrlFor(nft.channel)

      // Execute the burn via GalaChain
      // NFT burn always has quantity '1' for a single NFT
      const result = await burnTokens(
        [
          {
            tokenInstanceKey: tokenInstance,
            quantity: '1',
          },
        ],
        gatewayUrl,
      )

      if (result.success) {
        return { success: true }
      } else {
        burnError.value = result.error
        return { success: false, error: result.error }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      burnError.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      isBurning.value = false
    }
  }

  return {
    // State
    isLoading,
    isBurning,
    error,
    burnError,
    isConnected,
    ownerAddress,

    // Actions
    executeBurn,
    clearError,
    buildTokenInstance,
    canBurnNFT,
  }
}

export type UseBurnNFT = ReturnType<typeof useBurnNFT>
