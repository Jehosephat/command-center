import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type NetworkType = 'mainnet' | 'testnet'

const GATEWAY_HOSTS: Record<NetworkType, string> = {
  mainnet: 'https://gateway-mainnet.galachain.com',
  testnet: 'https://gateway-testnet.galachain.com',
}

const GATEWAY_URLS: Record<NetworkType, string> = {
  mainnet: `${GATEWAY_HOSTS.mainnet}/api/asset/token-contract`,
  testnet: `${GATEWAY_HOSTS.testnet}/api/asset/token-contract`,
}

/**
 * Additional channels (besides `asset`) that host NFT collections via token-contract.
 * Each channel exposes the same /api/{channel}/token-contract endpoints as asset.
 */
export const NFT_CHANNELS = [
  'mirandus',
  'championsarena',
  'echoesofempire',
  'eternalparadox',
  'galafilm',
  'lastexpedition',
  'legacy',
  'legendsreborn',
  'music',
  'node',
  'superior',
  'thewalkingdeadempires',
] as const

export type NftChannel = (typeof NFT_CHANNELS)[number]

/** All channels we fetch NFTs from, including the primary asset channel. */
export const ALL_NFT_CHANNELS: readonly (NftChannel | 'asset')[] = ['asset', ...NFT_CHANNELS]

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

  /**
   * Build the token-contract gateway URL for any channel on the current network.
   */
  function tokenContractUrlFor(channel: string): string {
    return `${GATEWAY_HOSTS[network.value]}/api/${channel}/token-contract`
  }

  /** Token-contract URLs for every NFT channel on the current network. */
  const nftChannelUrls = computed(() =>
    ALL_NFT_CHANNELS.map(channel => ({
      channel,
      url: tokenContractUrlFor(channel),
    })),
  )

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
    nftChannelUrls,
    // Actions
    setNetwork,
    toggleNetwork,
    tokenContractUrlFor,
  }
})
