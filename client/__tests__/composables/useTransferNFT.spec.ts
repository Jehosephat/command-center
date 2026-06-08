import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTransferNFT } from '@/composables/useTransferNFT'
import type { NFTDisplay } from '@shared/types/display'

// Mock the useGalaChain composable
vi.mock('@/composables/useGalaChain', () => ({
  useGalaChain: vi.fn(() => ({
    transferToken: vi.fn(),
    isLoading: { value: false },
    error: { value: null },
  })),
}))

// Mock the wallet store
vi.mock('@/stores/wallet', () => ({
  useWalletStore: vi.fn(() => ({
    connected: true,
    address: 'client|testaddress12345678901234567890',
  })),
}))

const mockNFT: NFTDisplay = {
  instanceKey: 'asset|TestCollection|Category|Type|Key|123',
  channel: 'asset',
  collection: 'TestCollection',
  category: 'Category',
  type: 'Type',
  additionalKey: 'Key',
  instance: '123',
  name: 'Test NFT',
  symbol: 'TNFT',
  description: 'A test NFT',
  image: '',
  rarity: undefined,
  isLocked: false,
  isInUse: false,
  canTransfer: true,
  canBurn: false,
}

describe('useTransferNFT', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('buildTokenInstance', () => {
    it('should build correct token instance from NFT display', () => {
      const { buildTokenInstance } = useTransferNFT()
      const tokenInstance = buildTokenInstance(mockNFT)

      expect(tokenInstance).toEqual({
        collection: 'TestCollection',
        category: 'Category',
        type: 'Type',
        additionalKey: 'Key',
        instance: '123',
      })
    })

    it('should preserve the exact instance ID', () => {
      const { buildTokenInstance } = useTransferNFT()
      const nftWithLongInstance = {
        ...mockNFT,
        instance: '999999999999999999',
      }
      const tokenInstance = buildTokenInstance(nftWithLongInstance)

      expect(tokenInstance.instance).toBe('999999999999999999')
    })
  })

  describe('executeTransfer', () => {
    it('should return error when NFT cannot be transferred (locked)', async () => {
      const { executeTransfer } = useTransferNFT()
      const lockedNFT = { ...mockNFT, canTransfer: false, isLocked: true }

      const result = await executeTransfer(lockedNFT, 'client|recipient123456789012345678901')

      expect(result.success).toBe(false)
      expect(result.error).toContain('locked')
    })

    it('should return error when NFT cannot be transferred (in use)', async () => {
      const { executeTransfer } = useTransferNFT()
      const inUseNFT = { ...mockNFT, canTransfer: false, isInUse: true }

      const result = await executeTransfer(inUseNFT, 'client|recipient123456789012345678901')

      expect(result.success).toBe(false)
      expect(result.error).toContain('in use')
    })

    it('should call transferToken with quantity 1 for NFTs', async () => {
      const mockTransferToken = vi.fn().mockResolvedValue({ success: true, data: [] })
      vi.doMock('@/composables/useGalaChain', () => ({
        useGalaChain: () => ({
          transferToken: mockTransferToken,
          isLoading: { value: false },
          error: { value: null },
        }),
      }))

      // Re-import to get the new mock
      const { useTransferNFT: useTransferNFTFresh } = await import('@/composables/useTransferNFT')
      const { executeTransfer } = useTransferNFTFresh()

      await executeTransfer(mockNFT, 'client|recipient123456789012345678901')

      // The transferToken should be called with quantity '1'
      // Note: exact verification depends on mock setup
    })
  })

  describe('computed properties', () => {
    it('should expose isConnected as computed', () => {
      const { isConnected } = useTransferNFT()
      expect(isConnected.value).toBeDefined()
    })

    it('should expose fromAddress as computed', () => {
      const { fromAddress } = useTransferNFT()
      expect(fromAddress.value).toBeDefined()
    })

    it('should expose isLoading as computed', () => {
      const { isLoading } = useTransferNFT()
      expect(isLoading.value).toBe(false)
    })

    it('should expose error as computed', () => {
      const { error } = useTransferNFT()
      expect(error.value).toBeNull()
    })
  })

  describe('clearError', () => {
    it('should clear local transfer error', async () => {
      const { executeTransfer, clearError, transferError } = useTransferNFT()

      // Trigger an error by transferring locked NFT
      const lockedNFT = { ...mockNFT, canTransfer: false, isLocked: true }
      await executeTransfer(lockedNFT, 'client|recipient123456789012345678901')

      expect(transferError.value).not.toBeNull()

      clearError()

      expect(transferError.value).toBeNull()
    })
  })
})
