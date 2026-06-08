import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NFTCard from '@/components/nfts/NFTCard.vue'
import type { NFTDisplay } from '@shared/types/display'

describe('NFTCard', () => {
  // Mock NFT data
  const mockNFT: NFTDisplay = {
    instanceKey: 'asset|TestCollection|Item|Sword||1',
    channel: 'asset',
    collection: 'TestCollection',
    category: 'Item',
    type: 'Sword',
    additionalKey: '',
    instance: '12345',
    name: 'Epic Sword',
    symbol: 'SWORD',
    description: 'A legendary weapon',
    image: '',
    rarity: 'Legendary',
    isLocked: false,
    isInUse: false,
    canTransfer: true,
    canBurn: false,
  }

  it('should render NFT name and collection', () => {
    const wrapper = mount(NFTCard, {
      props: { nft: mockNFT },
    })

    expect(wrapper.text()).toContain('Epic Sword')
    expect(wrapper.text()).toContain('TestCollection')
  })

  it('should display truncated instance ID', () => {
    const wrapper = mount(NFTCard, {
      props: { nft: mockNFT },
    })

    // Instance ID 12345 should be displayed as #12345 (not truncated - less than 8 chars)
    expect(wrapper.text()).toContain('#12345')
  })

  it('should truncate long instance IDs', () => {
    const longInstanceNFT = { ...mockNFT, instance: '123456789012' }
    const wrapper = mount(NFTCard, {
      props: { nft: longInstanceNFT },
    })

    // Should truncate to show first 4 and last 4 characters
    expect(wrapper.text()).toContain('#1234...9012')
  })

  it('should display rarity badge when available', () => {
    const wrapper = mount(NFTCard, {
      props: { nft: mockNFT },
    })

    expect(wrapper.text()).toContain('Legendary')
  })

  it('should not display rarity badge when not available', () => {
    const noRarityNFT = { ...mockNFT, rarity: undefined }
    const wrapper = mount(NFTCard, {
      props: { nft: noRarityNFT },
    })

    expect(wrapper.text()).not.toContain('Legendary')
  })

  it('should show Locked badge for locked NFTs', () => {
    const lockedNFT = { ...mockNFT, isLocked: true, canTransfer: false }
    const wrapper = mount(NFTCard, {
      props: { nft: lockedNFT },
    })

    expect(wrapper.text()).toContain('Locked')
  })

  it('should show In Use badge for in-use NFTs', () => {
    const inUseNFT = { ...mockNFT, isInUse: true, canTransfer: false }
    const wrapper = mount(NFTCard, {
      props: { nft: inUseNFT },
    })

    expect(wrapper.text()).toContain('In Use')
  })

  it('should show Burn badge when user has burn authority', () => {
    const burnableNFT = { ...mockNFT, canBurn: true }
    const wrapper = mount(NFTCard, {
      props: { nft: burnableNFT },
    })

    // Check for Burn badge in the image area
    const burnBadges = wrapper.findAll('[title="You can burn this NFT"]')
    expect(burnBadges.length).toBeGreaterThan(0)
  })

  it('should have Transfer button', () => {
    const wrapper = mount(NFTCard, {
      props: { nft: mockNFT },
    })

    const transferButton = wrapper.find('button')
    expect(transferButton.text()).toContain('Transfer')
  })

  it('should disable Transfer button when NFT cannot be transferred', () => {
    const lockedNFT = { ...mockNFT, canTransfer: false }
    const wrapper = mount(NFTCard, {
      props: { nft: lockedNFT },
    })

    const transferButton = wrapper.find('button')
    expect(transferButton.attributes('disabled')).toBeDefined()
  })

  it('should show Burn button when user has burn authority', () => {
    const burnableNFT = { ...mockNFT, canBurn: true }
    const wrapper = mount(NFTCard, {
      props: { nft: burnableNFT },
    })

    const buttons = wrapper.findAll('button')
    const burnButton = buttons.find(b => b.text() === 'Burn')
    expect(burnButton).toBeDefined()
  })

  it('should not show Burn button when user lacks burn authority', () => {
    const wrapper = mount(NFTCard, {
      props: { nft: mockNFT },
    })

    const buttons = wrapper.findAll('button')
    const burnButton = buttons.find(b => b.text() === 'Burn')
    expect(burnButton).toBeUndefined()
  })

  it('should emit transfer event when Transfer button is clicked', async () => {
    const wrapper = mount(NFTCard, {
      props: { nft: mockNFT },
    })

    const transferButton = wrapper.find('button')
    await transferButton.trigger('click')

    expect(wrapper.emitted('transfer')).toBeTruthy()
    expect(wrapper.emitted('transfer')![0]).toEqual([mockNFT])
  })

  it('should emit burn event when Burn button is clicked', async () => {
    const burnableNFT = { ...mockNFT, canBurn: true }
    const wrapper = mount(NFTCard, {
      props: { nft: burnableNFT },
    })

    const buttons = wrapper.findAll('button')
    const burnButton = buttons.find(b => b.text() === 'Burn')
    await burnButton!.trigger('click')

    expect(wrapper.emitted('burn')).toBeTruthy()
    expect(wrapper.emitted('burn')![0]).toEqual([burnableNFT])
  })

  it('should display placeholder when no image is available', () => {
    const wrapper = mount(NFTCard, {
      props: { nft: mockNFT },
    })

    // Should have SVG placeholder
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
  })

  it('should display image when available', () => {
    const nftWithImage = { ...mockNFT, image: 'https://example.com/nft.png' }
    const wrapper = mount(NFTCard, {
      props: { nft: nftWithImage },
    })

    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/nft.png')
  })
})
