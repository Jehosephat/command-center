/**
 * Composable for NFT transfer operations
 *
 * Provides a reactive interface for transferring NFTs (non-fungible tokens)
 * with integrated wallet signing and error handling.
 */

import { ref, computed } from 'vue'
import { useGalaChain } from '@/composables/useGalaChain'
import { useWalletStore } from '@/stores/wallet'
import { useNetworkStore } from '@/stores/network'
import type { NFTDisplay } from '@shared/types/display'
import type { TokenInstanceInput } from '@/lib/galachainClient'

export interface TransferNFTResult {
  success: boolean
  error?: string
}

/**
 * Composable for transferring NFTs
 */
export function useTransferNFT() {
  const { transferToken, isLoading: galaChainLoading, error: galaChainError } = useGalaChain()
  const walletStore = useWalletStore()
  const networkStore = useNetworkStore()

  // Local state for transfer operation
  const isTransferring = ref(false)
  const transferError = ref<string | null>(null)

  // Computed: combined loading state
  const isLoading = computed(() => isTransferring.value || galaChainLoading.value)

  // Computed: combined error state
  const error = computed(() => transferError.value || galaChainError.value)

  // Computed: whether the wallet is connected
  const isConnected = computed(() => walletStore.connected)

  // Computed: current wallet address
  const fromAddress = computed(() => walletStore.address || '')

  /**
   * Clear the error state
   */
  function clearError() {
    transferError.value = null
  }

  /**
   * Build a TokenInstanceInput from an NFTDisplay
   * NFTs always have a specific instance ID (non-zero)
   */
  function buildTokenInstance(nft: NFTDisplay): TokenInstanceInput {
    return {
      collection: nft.collection,
      category: nft.category,
      type: nft.type,
      additionalKey: nft.additionalKey,
      instance: nft.instance,
    }
  }

  /**
   * Execute an NFT transfer
   *
   * @param nft - The NFT to transfer
   * @param recipientAddress - The recipient's GalaChain address
   * @returns TransferNFTResult indicating success or failure
   */
  async function executeTransfer(
    nft: NFTDisplay,
    recipientAddress: string
  ): Promise<TransferNFTResult> {
    clearError()
    isTransferring.value = true

    try {
      // Validate wallet connection
      if (!walletStore.connected || !walletStore.address) {
        transferError.value = 'Wallet not connected. Please connect your wallet first.'
        return { success: false, error: transferError.value }
      }

      // Validate NFT can be transferred
      if (!nft.canTransfer) {
        transferError.value = nft.isLocked
          ? 'This NFT is currently locked and cannot be transferred.'
          : nft.isInUse
            ? 'This NFT is currently in use and cannot be transferred.'
            : 'This NFT cannot be transferred.'
        return { success: false, error: transferError.value }
      }

      // Build token instance for transfer
      const tokenInstance = buildTokenInstance(nft)

      // NFT transfers are always quantity 1
      const quantity = '1'

      // Route the transfer through the NFT's source channel
      const gatewayUrl = networkStore.tokenContractUrlFor(nft.channel)

      // Execute the transfer via GalaChain
      const result = await transferToken(recipientAddress, tokenInstance, quantity, gatewayUrl)

      if (result.success) {
        return { success: true }
      } else {
        transferError.value = result.error
        return { success: false, error: result.error }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      transferError.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      isTransferring.value = false
    }
  }

  return {
    // State
    isLoading,
    isTransferring,
    error,
    transferError,
    isConnected,
    fromAddress,

    // Actions
    executeTransfer,
    clearError,
    buildTokenInstance,
  }
}

export type UseTransferNFT = ReturnType<typeof useTransferNFT>
