import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import TransferNFTModal from '@/components/nfts/TransferNFTModal.vue'
import type { NFTDisplay } from '@shared/types/display'

// Mock the useTransferNFT composable
const mockExecuteTransfer = vi.fn()
const mockClearError = vi.fn()

vi.mock('@/composables/useTransferNFT', () => ({
  useTransferNFT: () => ({
    executeTransfer: mockExecuteTransfer,
    isTransferring: { value: false },
    error: { value: null },
    fromAddress: { value: 'client|sender12345678901234567890' },
    clearError: mockClearError,
  }),
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

// Mock HTMLDialogElement methods
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
  vi.clearAllMocks()
})

describe('TransferNFTModal', () => {
  const createWrapper = (props = {}) => {
    return mount(TransferNFTModal, {
      props: {
        nft: mockNFT,
        open: true,
        ...props,
      },
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            stubActions: false,
          }),
        ],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })
  }

  describe('rendering', () => {
    it('should render the modal when open is true', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('dialog').exists()).toBe(true)
    })

    it('should display NFT name in the preview', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Test NFT')
    })

    it('should display NFT collection in the preview', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('TestCollection')
    })

    it('should display NFT instance ID', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('#123')
    })

    it('should display rarity badge if NFT has rarity', () => {
      const nftWithRarity = { ...mockNFT, rarity: 'Legendary' }
      const wrapper = createWrapper({ nft: nftWithRarity })
      expect(wrapper.text()).toContain('Legendary')
    })

    it('should not display rarity badge if NFT has no rarity', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('.bg-purple-100').exists()).toBe(false)
    })

    it('should show header with "Transfer NFT" text', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('h2').text()).toBe('Transfer NFT')
    })
  })

  describe('form', () => {
    it('should have a recipient address input', () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input#recipientAddress')
      expect(input.exists()).toBe(true)
    })

    it('should have a Cancel button', () => {
      const wrapper = createWrapper()
      const cancelBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel')
      expect(cancelBtn).toBeDefined()
    })

    it('should have a Continue button', () => {
      const wrapper = createWrapper()
      const continueBtn = wrapper.findAll('button').find(b => b.text() === 'Continue')
      expect(continueBtn).toBeDefined()
    })

    it('should disable Continue button when form is invalid', () => {
      const wrapper = createWrapper()
      const continueBtn = wrapper.findAll('button').find(b => b.text() === 'Continue')
      expect(continueBtn?.attributes('disabled')).toBeDefined()
    })
  })

  describe('close functionality', () => {
    it('should have a Cancel button', () => {
      const wrapper = createWrapper()
      const cancelBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel')
      expect(cancelBtn).toBeDefined()
      // Button should exist and be clickable
      expect(cancelBtn?.exists()).toBe(true)
    })

    it('should have an X close button', () => {
      const wrapper = createWrapper()
      // Find the close button by SVG with X path
      const closeBtn = wrapper.findAll('button').find(b => b.html().includes('M6 18L18 6'))
      expect(closeBtn).toBeDefined()
    })

    it('should call clearError on reset', () => {
      // The clearError is called during resetFormState
      // which is called when the modal opens
      createWrapper()
      expect(mockClearError).toHaveBeenCalled()
    })
  })

  describe('NFT image handling', () => {
    it('should display NFT image when available', () => {
      const nftWithImage = { ...mockNFT, image: 'https://example.com/nft.png' }
      const wrapper = createWrapper({ nft: nftWithImage })
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('https://example.com/nft.png')
    })

    it('should display placeholder when no image', () => {
      const wrapper = createWrapper()
      // Check for placeholder SVG
      const placeholderSvg = wrapper.find('.w-8.h-8')
      expect(placeholderSvg.exists()).toBe(true)
    })
  })

  describe('truncation', () => {
    it('should truncate long instance IDs', () => {
      const nftWithLongInstance = {
        ...mockNFT,
        instance: '123456789012345678901234567890',
      }
      const wrapper = createWrapper({ nft: nftWithLongInstance })
      // The truncated ID should contain ...
      const instanceText = wrapper.text()
      expect(instanceText).toContain('...')
    })
  })

  describe('props', () => {
    it('should not render content when nft prop is null', () => {
      const wrapper = createWrapper({ nft: null })
      // The modal dialog exists but inner content should not render
      expect(wrapper.find('h3').exists()).toBe(false) // NFT name h3
    })
  })
})
