/**
 * Tests for useBurnNFT composable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBurnNFT } from '@/composables/useBurnNFT'
import { useWalletStore } from '@/stores/wallet'
import type { NFTDisplay } from '@shared/types/display'

// Mock useGalaChain composable
const mockBurnTokens = vi.fn()
vi.mock('@/composables/useGalaChain', () => ({
  useGalaChain: () => ({
    burnTokens: mockBurnTokens,
    isLoading: { value: false },
    error: { value: null },
  }),
}))

// Create mock NFT
function createMockNFT(overrides: Partial<NFTDisplay> = {}): NFTDisplay {
  return {
    instanceKey: 'asset|TEST|Category|Type||123',
    channel: 'asset',
    collection: 'TEST',
    category: 'Category',
    type: 'Type',
    additionalKey: '',
    instance: '123',
    name: 'Test NFT',
    symbol: 'TNFT',
    description: 'A test NFT',
    image: '',
    rarity: undefined,
    isLocked: false,
    isInUse: false,
    canTransfer: true,
    canBurn: true,
    ...overrides,
  }
}

describe('useBurnNFT', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('has isBurning as false', () => {
      const { isBurning } = useBurnNFT()
      expect(isBurning.value).toBe(false)
    })

    it('has error as null', () => {
      const { burnError } = useBurnNFT()
      expect(burnError.value).toBeNull()
    })

    it('reflects wallet connection status', () => {
      const { isConnected } = useBurnNFT()
      expect(isConnected.value).toBe(false)
    })

    it('has empty owner address when not connected', () => {
      const { ownerAddress } = useBurnNFT()
      expect(ownerAddress.value).toBe('')
    })
  })

  describe('buildTokenInstance', () => {
    it('builds correct token instance from NFT', () => {
      const { buildTokenInstance } = useBurnNFT()
      const nft = createMockNFT()

      const instance = buildTokenInstance(nft)

      expect(instance).toEqual({
        collection: 'TEST',
        category: 'Category',
        type: 'Type',
        additionalKey: '',
        instance: '123',
      })
    })

    it('uses the specific NFT instance ID', () => {
      const { buildTokenInstance } = useBurnNFT()
      const nft = createMockNFT({ instance: '456789' })

      const instance = buildTokenInstance(nft)

      expect(instance.instance).toBe('456789')
    })

    it('handles NFT with additionalKey', () => {
      const { buildTokenInstance } = useBurnNFT()
      const nft = createMockNFT({ additionalKey: 'extra' })

      const instance = buildTokenInstance(nft)

      expect(instance.additionalKey).toBe('extra')
    })
  })

  describe('canBurnNFT', () => {
    it('returns canBurn true for valid NFT', () => {
      const { canBurnNFT } = useBurnNFT()
      const nft = createMockNFT()

      const result = canBurnNFT(nft)

      expect(result.canBurn).toBe(true)
      expect(result.reason).toBeUndefined()
    })

    it('returns canBurn false when no burn authority', () => {
      const { canBurnNFT } = useBurnNFT()
      const nft = createMockNFT({ canBurn: false })

      const result = canBurnNFT(nft)

      expect(result.canBurn).toBe(false)
      expect(result.reason).toContain('burn authority')
    })

    it('returns canBurn false when NFT is locked', () => {
      const { canBurnNFT } = useBurnNFT()
      const nft = createMockNFT({ isLocked: true })

      const result = canBurnNFT(nft)

      expect(result.canBurn).toBe(false)
      expect(result.reason).toContain('locked')
    })

    it('returns canBurn false when NFT is in use', () => {
      const { canBurnNFT } = useBurnNFT()
      const nft = createMockNFT({ isInUse: true })

      const result = canBurnNFT(nft)

      expect(result.canBurn).toBe(false)
      expect(result.reason).toContain('in use')
    })
  })

  describe('executeBurn', () => {
    it('returns error when wallet not connected', async () => {
      const { executeBurn } = useBurnNFT()
      const nft = createMockNFT()

      const result = await executeBurn(nft)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Wallet not connected')
    })

    it('returns error when NFT cannot be burned', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      const { executeBurn } = useBurnNFT()
      const nft = createMockNFT({ canBurn: false })

      const result = await executeBurn(nft)

      expect(result.success).toBe(false)
      expect(result.error).toContain('burn authority')
      expect(mockBurnTokens).not.toHaveBeenCalled()
    })

    it('returns error when NFT is locked', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      const { executeBurn } = useBurnNFT()
      const nft = createMockNFT({ isLocked: true })

      const result = await executeBurn(nft)

      expect(result.success).toBe(false)
      expect(result.error).toContain('locked')
    })

    it('calls burnTokens with quantity 1 for NFT', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      mockBurnTokens.mockResolvedValue({ success: true })

      const { executeBurn } = useBurnNFT()
      const nft = createMockNFT()

      await executeBurn(nft)

      // NFT burn always has quantity '1', routed through NFT's channel gateway
      expect(mockBurnTokens).toHaveBeenCalledWith(
        [
          {
            tokenInstanceKey: expect.objectContaining({
              collection: 'TEST',
              category: 'Category',
              type: 'Type',
              additionalKey: '',
              instance: '123',
            }),
            quantity: '1',
          },
        ],
        expect.stringContaining('/api/asset/token-contract'),
      )
    })

    it('returns success result on successful burn', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      mockBurnTokens.mockResolvedValue({ success: true })

      const { executeBurn } = useBurnNFT()
      const nft = createMockNFT()

      const result = await executeBurn(nft)

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns error result on failed burn', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      mockBurnTokens.mockResolvedValue({
        success: false,
        error: 'Burn failed',
      })

      const { executeBurn } = useBurnNFT()
      const nft = createMockNFT()

      const result = await executeBurn(nft)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Burn failed')
    })

    it('sets isBurning to true during burn', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      let resolveBurn: (value: { success: boolean }) => void
      mockBurnTokens.mockImplementation(() => new Promise((resolve) => {
        resolveBurn = resolve
      }))

      const { executeBurn, isBurning } = useBurnNFT()
      const nft = createMockNFT()

      const burnPromise = executeBurn(nft)

      expect(isBurning.value).toBe(true)

      resolveBurn!({ success: true })
      await burnPromise

      expect(isBurning.value).toBe(false)
    })

    it('handles thrown errors', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      mockBurnTokens.mockRejectedValue(new Error('Network error'))

      const { executeBurn } = useBurnNFT()
      const nft = createMockNFT()

      const result = await executeBurn(nft)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('clearError', () => {
    it('clears the burn error', async () => {
      const walletStore = useWalletStore()
      walletStore.$patch({
        connected: true,
        address: 'client|testaddress123',
      })

      mockBurnTokens.mockResolvedValue({
        success: false,
        error: 'Some error',
      })

      const { executeBurn, burnError, clearError } = useBurnNFT()
      const nft = createMockNFT()

      await executeBurn(nft)
      expect(burnError.value).toBe('Some error')

      clearError()
      expect(burnError.value).toBeNull()
    })
  })
})
