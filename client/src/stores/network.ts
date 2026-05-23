import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type NetworkType = 'mainnet' | 'testnet'

const GATEWAY_URLS: Record<NetworkType, string> = {
  mainnet: 'https://gateway-mainnet.galachain.com/api/asset/token-contract',
  testnet: 'https://gateway-testnet.galachain.com/api/asset/token-contract',
}

const STORAGE_KEY = 'galachain-network'

/**
 * Get initial network from localStorage or default to mainnet
 */
function getInitialNetwork(): NetworkType {
  if (typeof window === 'undefined') return 'mainnet'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'mainnet' || stored === 'testnet') {
    return stored
  }
  return 'mainnet'
}

export const useNetworkStore = defineStore('network', () => {
  // State
  const network = ref<NetworkType>(getInitialNetwork())

  // Getters
  const isMainnet = computed(() => network.value === 'mainnet')
  const isTestnet = computed(() => network.value === 'testnet')
  const gatewayUrl = computed(() => GATEWAY_URLS[network.value])
  const publicKeyGatewayUrl = computed(() =>
    gatewayUrl.value.replace(/\/token-contract\/?$/i, '/public-key-contract'),
  )
  const networkLabel = computed(() => network.value === 'mainnet' ? 'Mainnet' : 'Testnet')

  // Actions
  function setNetwork(newNetwork: NetworkType) {
    network.value = newNetwork
    localStorage.setItem(STORAGE_KEY, newNetwork)
  }

  function toggleNetwork() {
    setNetwork(network.value === 'mainnet' ? 'testnet' : 'mainnet')
  }

  return {
    // State
    network,
    // Getters
    isMainnet,
    isTestnet,
    gatewayUrl,
    publicKeyGatewayUrl,
    networkLabel,
    // Actions
    setNetwork,
    toggleNetwork,
  }
})
