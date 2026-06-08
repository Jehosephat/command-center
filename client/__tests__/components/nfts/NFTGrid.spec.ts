import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NFTGrid from '@/components/nfts/NFTGrid.vue'
import NFTCard from '@/components/nfts/NFTCard.vue'
import NFTCardSkeleton from '@/components/nfts/NFTCardSkeleton.vue'
import type { NFTDisplay } from '@shared/types/display'

describe('NFTGrid', () => {
  // Mock NFT data
  const mockNFTs: NFTDisplay[] = [
    {
      instanceKey: 'asset|TestCollection|Item|Sword||1',
      channel: 'asset',
      collection: 'TestCollection',
      category: 'Item',
      type: 'Sword',
      additionalKey: '',
      instance: '1',
      name: 'Epic Sword',
      symbol: 'SWORD',
      description: '',
      image: '',
      rarity: undefined,
      isLocked: false,
      isInUse: false,
      canTransfer: true,
      canBurn: false,
    },
    {
      instanceKey: 'asset|TestCollection|Item|Shield||2',
      channel: 'asset',
      collection: 'TestCollection',
      category: 'Item',
      type: 'Shield',
      additionalKey: '',
      instance: '2',
      name: 'Iron Shield',
      symbol: 'SHIELD',
      description: '',
      image: '',
      rarity: undefined,
      isLocked: false,
      isInUse: false,
      canTransfer: true,
      canBurn: false,
    },
  ]

  it('should render NFT cards when NFTs are provided', () => {
    const wrapper = mount(NFTGrid, {
      props: { nfts: mockNFTs, isLoading: false },
      global: {
        components: { NFTCard, NFTCardSkeleton },
      },
    })

    const cards = wrapper.findAllComponents(NFTCard)
    expect(cards.length).toBe(2)
  })

  it('should render loading skeletons when loading and no NFTs', () => {
    const wrapper = mount(NFTGrid, {
      props: { nfts: [], isLoading: true },
      global: {
        components: { NFTCard, NFTCardSkeleton },
      },
    })

    const skeletons = wrapper.findAllComponents(NFTCardSkeleton)
    expect(skeletons.length).toBe(8) // Default skeleton count
  })

  it('should render empty state when no NFTs and not loading', () => {
    const wrapper = mount(NFTGrid, {
      props: { nfts: [], isLoading: false },
      global: {
        components: { NFTCard, NFTCardSkeleton },
      },
    })

    expect(wrapper.text()).toContain('No NFTs found')
  })

  it('should emit transfer event from child NFTCard', async () => {
    const wrapper = mount(NFTGrid, {
      props: { nfts: mockNFTs, isLoading: false },
      global: {
        components: { NFTCard, NFTCardSkeleton },
      },
    })

    const firstCard = wrapper.findComponent(NFTCard)
    await firstCard.vm.$emit('transfer', mockNFTs[0])

    expect(wrapper.emitted('transfer')).toBeTruthy()
    expect(wrapper.emitted('transfer')![0]).toEqual([mockNFTs[0]])
  })

  it('should emit burn event from child NFTCard', async () => {
    const burnableNFTs = mockNFTs.map(n => ({ ...n, canBurn: true }))
    const wrapper = mount(NFTGrid, {
      props: { nfts: burnableNFTs, isLoading: false },
      global: {
        components: { NFTCard, NFTCardSkeleton },
      },
    })

    const firstCard = wrapper.findComponent(NFTCard)
    await firstCard.vm.$emit('burn', burnableNFTs[0])

    expect(wrapper.emitted('burn')).toBeTruthy()
    expect(wrapper.emitted('burn')![0]).toEqual([burnableNFTs[0]])
  })

  it('should show NFTs when loading but NFTs already exist', () => {
    const wrapper = mount(NFTGrid, {
      props: { nfts: mockNFTs, isLoading: true },
      global: {
        components: { NFTCard, NFTCardSkeleton },
      },
    })

    // Should show NFTs, not skeletons
    const cards = wrapper.findAllComponents(NFTCard)
    const skeletons = wrapper.findAllComponents(NFTCardSkeleton)
    expect(cards.length).toBe(2)
    expect(skeletons.length).toBe(0)
  })

  it('should have proper grid layout classes', () => {
    const wrapper = mount(NFTGrid, {
      props: { nfts: mockNFTs, isLoading: false },
      global: {
        components: { NFTCard, NFTCardSkeleton },
      },
    })

    const grid = wrapper.find('.grid')
    expect(grid.classes()).toContain('gap-4')
    expect(grid.classes()).toContain('grid-cols-1')
  })
})
