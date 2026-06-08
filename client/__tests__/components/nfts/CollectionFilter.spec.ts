import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CollectionFilter from '@/components/nfts/CollectionFilter.vue'
import type { CollectionDisplay } from '@shared/types/display'

describe('CollectionFilter', () => {
  // Mock collections data — collectionKey is now just the collection name
  const mockCollections: CollectionDisplay[] = [
    {
      collectionKey: 'TestCollection',
      collection: 'TestCollection',
      category: '',
      type: '',
      additionalKey: '',
      name: 'TestCollection',
      symbol: 'SWORD',
      description: '',
      image: '',
      isNonFungible: true,
      maxSupply: '0',
      totalSupply: '100',
      totalBurned: '0',
      isAuthority: false,
      ownedCount: 5,
    },
    {
      collectionKey: 'AnotherCollection',
      collection: 'AnotherCollection',
      category: '',
      type: '',
      additionalKey: '',
      name: 'AnotherCollection',
      symbol: 'CHAR',
      description: '',
      image: '',
      isNonFungible: true,
      maxSupply: '1000',
      totalSupply: '500',
      totalBurned: '10',
      isAuthority: false,
      ownedCount: 3,
    },
  ]

  // Mock document.addEventListener
  beforeEach(() => {
    vi.spyOn(document, 'addEventListener')
    vi.spyOn(document, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render dropdown button with "All Collections" when no filter selected', () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: null,
      },
    })

    const button = wrapper.find('button')
    expect(button.text()).toContain('All Collections')
  })

  it('should render selected collection name when filter is set', () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: 'TestCollection',
      },
    })

    const button = wrapper.find('button')
    expect(button.text()).toContain('TestCollection')
  })

  it('should toggle dropdown when button is clicked', async () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: null,
      },
    })

    // Initially closed
    expect(wrapper.find('[role="listbox"], .py-1').exists()).toBe(false)

    // Click to open
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.py-1').exists()).toBe(true)

    // Click to close
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.py-1').exists()).toBe(false)
  })

  it('should emit update:modelValue with null when "All Collections" is selected', async () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: 'TestCollection',
      },
    })

    // Open dropdown
    await wrapper.find('button').trigger('click')

    // Click "All Collections"
    const allButton = wrapper.findAll('.py-1 button')[0]
    await allButton.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([null])
  })

  it('should emit update:modelValue with collection key when a collection is selected', async () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: null,
      },
    })

    // Open dropdown
    await wrapper.find('button').trigger('click')

    // Find and click the second collection (after "All Collections" and hr)
    const collectionButtons = wrapper.findAll('.py-1 button').filter(b => b.text().includes('TestCollection'))
    await collectionButtons[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['TestCollection'])
  })

  it('should display owned count for each collection', async () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: null,
      },
    })

    // Open dropdown
    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('5 owned')
    expect(wrapper.text()).toContain('3 owned')
  })

  it('should show checkmark for selected collection', async () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: 'TestCollection',
      },
    })

    // Open dropdown
    await wrapper.find('button').trigger('click')

    // Find the selected collection button
    const selectedButton = wrapper.findAll('.py-1 button').find(b => b.text().includes('TestCollection'))
    expect(selectedButton?.classes()).toContain('text-gala-primary')
  })

  it('should close dropdown after selection', async () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: null,
      },
    })

    // Open dropdown
    await wrapper.find('button').trigger('click')
    expect(wrapper.find('.py-1').exists()).toBe(true)

    // Select a collection
    const collectionButtons = wrapper.findAll('.py-1 button').filter(b => b.text().includes('TestCollection'))
    await collectionButtons[0].trigger('click')

    // Dropdown should be closed
    expect(wrapper.find('.py-1').exists()).toBe(false)
  })

  it('should show empty state when no collections', async () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: [],
        modelValue: null,
      },
    })

    // Open dropdown
    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('No collections found')
  })

  it('should add click outside listener on mount', () => {
    mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: null,
      },
    })

    expect(document.addEventListener).toHaveBeenCalledWith('click', expect.any(Function))
  })

  it('should remove click outside listener on unmount', () => {
    const wrapper = mount(CollectionFilter, {
      props: {
        collections: mockCollections,
        modelValue: null,
      },
    })

    wrapper.unmount()

    expect(document.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function))
  })
})
