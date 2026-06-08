/**
 * Composable for GalaChain operations
 *
 * Provides reactive access to GalaChain operations integrated with the wallet store.
 * - Read operations (balances, allowances) do NOT require wallet connection
 * - Write operations (transfer, mint, burn) require wallet connection for signing
 */

import { computed, ref } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import {
  fetchBalances,
  fetchBalancesWithMetadata,
  fetchAllowances,
  transfer,
  mint,
  burn,
  getGalaChainConfig,
  type TokenInstanceInput,
  type TokenBalance,
  type TokenBalanceWithMetadata,
} from '@/lib/galachainClient'
import { GalaChainError, parseWalletError, logError } from '@/lib/galachainErrors'
import type { TokenAllowance } from '@gala-chain/api'
import type BigNumber from 'bignumber.js'

/**
 * Operation state for tracking async operations
 */
export interface OperationState {
  isLoading: boolean
  error: string | null
}

/**
 * Result of an operation
 */
export type OperationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

/**
 * Composable for GalaChain operations
 */
export function useGalaChain() {
  const walletStore = useWalletStore()

  // Reactive state
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isConnected = computed(() => walletStore.connected)
  const walletAddress = computed(() => walletStore.address)
  const config = computed(() => getGalaChainConfig())

  /**
   * Get the BrowserConnectClient, throwing if not connected
   * Used for write operations that require signing
   */
  function requireClient() {
    const client = walletStore.getClient()
    if (!client) {
      throw new GalaChainError(
        'Wallet not connected. Please connect your wallet first.',
        'WALLET_NOT_CONNECTED'
      )
    }
    return client
  }

  /**
   * Execute an async operation with error handling
   */
  async function executeOperation<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<OperationResult<T>> {
    isLoading.value = true
    error.value = null

    try {
      const data = await operation()
      return { success: true, data }
    } catch (err) {
      logError(context, err)

      const errorMessage =
        err instanceof GalaChainError
          ? err.message
          : parseWalletError(err)

      error.value = errorMessage
      return { success: false, error: errorMessage }
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clear the current error state
   */
  function clearError() {
    error.value = null
  }

  // ============================================================================
  // Read Operations (NO wallet signing required)
  // ============================================================================

  /**
   * Fetch token balances for an address
   * This is a read-only operation that does NOT require wallet connection
   * @param owner - Owner address to fetch balances for (required)
   * @param filters - Optional filters for collection, category, type, additionalKey
   * @deprecated Use getBalancesWithMetadata for better display data
   */
  async function getBalances(
    owner: string,
    filters?: {
      collection?: string
      category?: string
      type?: string
      additionalKey?: string
    }
  ): Promise<OperationResult<TokenBalance[]>> {
    return executeOperation(async () => {
      if (!owner) {
        throw new GalaChainError('Owner address is required.', 'NO_ADDRESS')
      }
      return fetchBalances(owner, filters)
    }, 'getBalances')
  }

  /**
   * Fetch token balances with metadata (includes token class info like name, symbol, image)
   * This is the preferred method for displaying tokens as it includes all display data
   * This is a read-only operation that does NOT require wallet connection
   * @param owner - Owner address to fetch balances for (required)
   * @param filters - Optional filters for collection, category, type, additionalKey
   * @param gatewayUrl - Optional channel-specific token-contract URL (defaults to asset channel)
   */
  async function getBalancesWithMetadata(
    owner: string,
    filters?: {
      collection?: string
      category?: string
      type?: string
      additionalKey?: string
    },
    gatewayUrl?: string,
  ): Promise<OperationResult<TokenBalanceWithMetadata[]>> {
    return executeOperation(async () => {
      if (!owner) {
        throw new GalaChainError('Owner address is required.', 'NO_ADDRESS')
      }
      return fetchBalancesWithMetadata(owner, filters, gatewayUrl)
    }, 'getBalancesWithMetadata')
  }

  /**
   * Fetch token allowances for an address
   * This is a read-only operation that does NOT require wallet connection
   * @param grantedTo - Address to check allowances for (required)
   * @param filters - Optional filters for collection, category, type, etc.
   */
  async function getAllowances(
    grantedTo: string,
    filters?: {
      collection?: string
      category?: string
      type?: string
      additionalKey?: string
      grantedBy?: string
    }
  ): Promise<OperationResult<TokenAllowance[]>> {
    return executeOperation(async () => {
      if (!grantedTo) {
        throw new GalaChainError('Address is required.', 'NO_ADDRESS')
      }
      return fetchAllowances(grantedTo, filters)
    }, 'getAllowances')
  }

  // ============================================================================
  // Write Operations (requires wallet signing)
  // ============================================================================

  /**
   * Transfer tokens to another address
   * Requires wallet connection for signing
   * @param to - Recipient address
   * @param tokenInstance - Token to transfer
   * @param quantity - Amount to transfer
   * @param gatewayUrl - Optional channel-specific token-contract URL (defaults to asset channel)
   */
  async function transferToken(
    to: string,
    tokenInstance: TokenInstanceInput,
    quantity: BigNumber | string | number,
    gatewayUrl?: string,
  ): Promise<OperationResult<TokenBalance[]>> {
    return executeOperation(async () => {
      const client = requireClient()
      const from = walletStore.address
      if (!from) {
        throw new GalaChainError('No wallet address available.', 'NO_ADDRESS')
      }
      return transfer(client, from, to, tokenInstance, quantity, gatewayUrl)
    }, 'transferToken')
  }

  /**
   * Mint tokens (requires mint authority)
   * Requires wallet connection for signing
   * @param tokenClass - Token class to mint
   * @param quantity - Amount to mint
   * @param owner - Recipient of minted tokens (defaults to connected wallet)
   */
  async function mintToken(
    tokenClass: {
      collection: string
      category: string
      type: string
      additionalKey: string
    },
    quantity: BigNumber | string | number,
    owner?: string
  ): Promise<OperationResult<unknown[]>> {
    return executeOperation(async () => {
      const client = requireClient()
      const recipient = owner || walletStore.address
      if (!recipient) {
        throw new GalaChainError('No wallet address available.', 'NO_ADDRESS')
      }
      return mint(client, tokenClass, recipient, quantity)
    }, 'mintToken')
  }

  /**
   * Burn tokens (requires burn authority or ownership)
   * Requires wallet connection for signing
   * @param tokenInstances - Array of tokens and quantities to burn
   * @param gatewayUrl - Optional channel-specific token-contract URL (defaults to asset channel)
   */
  async function burnTokens(
    tokenInstances: Array<{
      tokenInstanceKey: TokenInstanceInput
      quantity: BigNumber | string | number
    }>,
    gatewayUrl?: string,
  ): Promise<OperationResult<unknown[]>> {
    return executeOperation(async () => {
      const client = requireClient()
      return burn(client, tokenInstances, gatewayUrl)
    }, 'burnTokens')
  }

  return {
    // State
    isLoading,
    error,

    // Computed
    isConnected,
    walletAddress,
    config,

    // Actions
    clearError,

    // Read operations (no signing required)
    getBalances,
    getBalancesWithMetadata,
    getAllowances,

    // Write operations (signing required)
    transferToken,
    mintToken,
    burnTokens,
  }
}

// Export types for use in components
export type UseGalaChain = ReturnType<typeof useGalaChain>
