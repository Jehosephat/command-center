import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { BrowserConnectClient } from '@gala-chain/connect'
import { signatures } from '@gala-chain/api'
import type { WalletState, WalletConnectionStatus } from '@shared/types/wallet'

/**
 * Pinia store for managing wallet connection state
 */
export const useWalletStore = defineStore('wallet', () => {
  // State
  const connected = ref(false)
  const address = ref<string | null>(null)
  const publicKey = ref<string | null>(null)
  const isConnecting = ref(false)
  const error = ref<string | null>(null)

  // Persist connection state to localStorage for auto-reconnect
  const wasConnected = useStorage('wallet-was-connected', false)

  // The BrowserConnectClient instance (not reactive, created on connect)
  let client: BrowserConnectClient | null = null

  // Getters
  const status = computed<WalletConnectionStatus>(() => {
    if (isConnecting.value) return 'connecting' as WalletConnectionStatus
    if (error.value) return 'error' as WalletConnectionStatus
    if (connected.value) return 'connected' as WalletConnectionStatus
    return 'disconnected' as WalletConnectionStatus
  })

  const truncatedAddress = computed(() => {
    if (!address.value) return ''
    // Handle both eth| and client| prefixed addresses
    const addr = address.value
    if (addr.length <= 12) return addr
    return `${addr.slice(0, 8)}...${addr.slice(-4)}`
  })

  const state = computed<WalletState>(() => ({
    connected: connected.value,
    address: address.value,
    publicKey: publicKey.value,
    isConnecting: isConnecting.value,
    error: error.value,
  }))

  // Actions

  /**
   * Connect to the wallet using MetaMask or other injected provider
   */
  async function connect(): Promise<void> {
    // Check if MetaMask is installed
    if (typeof window === 'undefined' || !window.ethereum) {
      error.value = 'MetaMask is not installed. Please install MetaMask to connect your wallet.'
      return
    }

    isConnecting.value = true
    error.value = null

    try {
      // Create a new BrowserConnectClient instance
      client = new BrowserConnectClient()

      // Override sign() to use personal_sign correctly.
      //
      // The SDK default (SIGN_TYPED_DATA) submits domain+types fields in the DTO,
      // causing GalaChain's server to use EIP-712 verification. But GalaChain's
      // gateway authenticates via personal_sign (as shown in eth.spec.ts#L376).
      //
      // The SDK's PERSONAL_SIGN path is also wrong — it signs serialize(prefixedPayload),
      // which embeds the prefix field in the JSON. The server verifies
      // keccak256(prefix + serialize(plain_without_prefix)), so the signed data
      // must be serialize(plain) only.
      ;(client as any).sign = async (_method: string, payload: Record<string, unknown>) => {
        // getPayloadToSign strips signature/prefix/multisig/trace and returns serialize(plain)
        const data = signatures.getPayloadToSign(payload as object)
        const prefix = `\u0019Ethereum Signed Message:\n${data.length}`
        const signature = await client!.signMessage(data)
        return { ...payload, prefix, signature }
      }

      // Listen for account changes
      client.on('accountsChanged', handleAccountsChanged)

      // Connect to the wallet - this triggers the MetaMask popup
      const galaChainAddress = await client.connect()

      // Get the public key
      const { publicKey: pubKey } = await client.getPublicKey()

      // Update state
      address.value = galaChainAddress
      publicKey.value = pubKey
      connected.value = true
      wasConnected.value = true

    } catch (err) {
      // Handle user rejection or other errors
      const errorMessage = getWalletErrorMessage(err)
      error.value = errorMessage
      connected.value = false
      address.value = null
      publicKey.value = null
    } finally {
      isConnecting.value = false
    }
  }

  /**
   * Disconnect from the wallet
   */
  function disconnect(): void {
    if (client) {
      client.off('accountsChanged', handleAccountsChanged)
      client.disconnect()
      client = null
    }

    connected.value = false
    address.value = null
    publicKey.value = null
    error.value = null
    wasConnected.value = false
  }

  /**
   * Check if we should auto-reconnect and attempt reconnection
   */
  async function checkConnection(): Promise<void> {
    if (wasConnected.value && !connected.value && !isConnecting.value) {
      await connect()
    }
  }

  /**
   * Get the current BrowserConnectClient instance
   * Used by other composables/stores to sign transactions
   */
  function getClient(): BrowserConnectClient | null {
    return client
  }

  /**
   * Handle account changes from MetaMask
   */
  function handleAccountsChanged(accounts: string[] | string | null): void {
    if (!accounts || (Array.isArray(accounts) && accounts.length === 0)) {
      // User disconnected their wallet
      disconnect()
    } else if (Array.isArray(accounts) && accounts.length > 0) {
      // User switched accounts - reconnect
      connect()
    }
  }

  /**
   * Clear any error state
   */
  function clearError(): void {
    error.value = null
  }

  return {
    // State
    connected,
    address,
    publicKey,
    isConnecting,
    error,
    // Getters
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
})

/**
 * Parse wallet errors into user-friendly messages
 */
function getWalletErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message.toLowerCase()

    // User rejected the connection request
    if (message.includes('user rejected') || message.includes('user denied')) {
      return 'Connection request was rejected. Please approve the connection in your wallet.'
    }

    // MetaMask is locked
    if (message.includes('locked') || message.includes('unlock')) {
      return 'Your wallet is locked. Please unlock your wallet and try again.'
    }

    // No provider found
    if (message.includes('no provider') || message.includes('ethereum provider')) {
      return 'No wallet provider found. Please install MetaMask.'
    }

    // Already processing
    if (message.includes('already pending') || message.includes('pending request')) {
      return 'A connection request is already pending. Please check your wallet.'
    }

    return err.message
  }

  return 'An unexpected error occurred while connecting to your wallet.'
}

// Export types for testing
export type WalletStore = ReturnType<typeof useWalletStore>
