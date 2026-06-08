/**
 * Tests for BurnNFTModal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import BurnNFTModal from '@/components/nfts/BurnNFTModal.vue'
import type { NFTDisplay } from '@shared/types/display'

// Mock the useBurnNFT composable
const mockExecuteBurn = vi.fn()
const mockClearError = vi.fn()
const mockCanBurnNFT = vi.fn()

vi.mock('@/composables/useBurnNFT', () => ({
  useBurnNFT: () => ({
    executeBurn: mockExecuteBurn,
    isBurning: { value: false },
    error: { value: null },
    burnError: { value: null },
    ownerAddress: { value: 'client|testaddress123' },
    clearError: mockClearError,
    canBurnNFT: mockCanBurnNFT,
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

describe('BurnNFTModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock dialog element methods
    HTMLDialogElement.prototype.showModal = vi.fn()
    HTMLDialogElement.prototype.close = vi.fn()

    // Default mock for canBurnNFT
    mockCanBurnNFT.mockReturnValue({ canBurn: true })
  })

  it('renders when open with NFT', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.find('dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain('Burn NFT')
  })

  it('displays NFT info correctly', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ name: 'My NFT', collection: 'MyCollection' }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).toContain('My NFT')
    expect(wrapper.text()).toContain('MyCollection')
  })

  it('displays NFT instance ID', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ instance: '456' }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).toContain('#456')
  })

  it('truncates long instance IDs', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ instance: '123456789012' }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).toContain('#1234...9012')
  })

  it('displays warning banner about permanent destruction', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).toContain('permanently destroyed')
    expect(wrapper.text()).toContain('cannot be reversed')
  })

  it('has confirmation checkbox', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const checkbox = wrapper.find('input[type="checkbox"]')
    expect(checkbox.exists()).toBe(true)
    expect(wrapper.text()).toContain('permanent and cannot be undone')
  })

  it('has cancel and continue buttons', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Cancel')
    expect(wrapper.text()).toContain('Continue')
  })

  it('continue button is disabled when checkbox not checked', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const continueButton = wrapper.findAll('button').find((b) => b.text() === 'Continue')
    expect(continueButton?.attributes('disabled')).toBeDefined()
  })

  it('shows cannot burn warning when canBurnNFT returns false', () => {
    mockCanBurnNFT.mockReturnValue({ canBurn: false, reason: 'NFT is locked' })

    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ isLocked: true }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).toContain('NFT is locked')
  })

  it('disables continue button when NFT cannot be burned', () => {
    mockCanBurnNFT.mockReturnValue({ canBurn: false, reason: 'NFT is locked' })

    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ isLocked: true }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const continueButton = wrapper.findAll('button').find((b) => b.text() === 'Continue')
    expect(continueButton?.attributes('disabled')).toBeDefined()
  })

  it('has Cancel button that exists', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    const cancelButton = buttons.find((b) => b.text() === 'Cancel')
    expect(cancelButton).toBeDefined()
    expect(cancelButton?.exists()).toBe(true)
  })

  it('has X close button in header', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    // X button is in the header - verify it exists
    const headerButtons = wrapper.findAll('button[type="button"]')
    const closeButton = headerButtons[0] // First button is the X close button
    expect(closeButton.exists()).toBe(true)
  })

  it('does not render content when NFT is null', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: null,
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    // The dialog exists but inner content should not render
    expect(wrapper.find('dialog').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('permanently destroyed')
  })

  it('displays rarity badge when NFT has rarity', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ rarity: 'Legendary' }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Legendary')
  })

  it('calls showModal when open prop becomes true', async () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: false,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    await wrapper.setProps({ open: true })

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled()
  })

  it('displays red styling for burn action', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT(),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    // Check that the warning has red styling
    const warningBanner = wrapper.find('.bg-red-50')
    expect(warningBanner.exists()).toBe(true)
  })

  it('shows NFT placeholder when no image', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ image: '' }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    // Should have a placeholder SVG instead of img
    const img = wrapper.find('img')
    const svg = wrapper.findAll('svg')
    // When no image, there should be a placeholder SVG
    expect(svg.length).toBeGreaterThan(0)
  })

  it('shows NFT image when provided', () => {
    const wrapper = mount(BurnNFTModal, {
      props: {
        nft: createMockNFT({ image: 'https://example.com/nft.png' }),
        open: true,
      },
      global: {
        plugins: [createTestingPinia()],
        stubs: {
          LoadingSpinner: true,
        },
      },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/nft.png')
  })
})
