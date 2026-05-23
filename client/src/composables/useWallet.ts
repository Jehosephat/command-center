import { storeToRefs } from 'pinia'
import { useWalletStore } from '@/stores/wallet'

/**
 * Composable for wallet connection functionality
 * Wraps the wallet store for convenient use in components
 */
export function useWallet() {
  const walletStore = useWalletStore()

  // Extract reactive refs from store
  const {
    connected,
    address,
    alias,
    publicKey,
    isConnecting,
    error,
    status,
    truncatedAddress,
    state,
  } = storeToRefs(walletStore)

  // Actions
  const { connect, disconnect, checkConnection, getClient, clearError } = walletStore

  return {
    // State (reactive refs)
    connected,
    address,
    alias,
    publicKey,
    isConnecting,
    error,
    // Computed (reactive refs)
    status,
    truncatedAddress,
    state,
    // Actions
    connect,
    disconnect,
    checkConnection,
    getClient,
    clearError,
  }
}
