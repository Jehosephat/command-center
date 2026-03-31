import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MarketplaceListing, MarketplacePurchase } from '@shared/types/marketplace'

export const useMarketplaceStore = defineStore('marketplace', () => {
  const listings = ref<MarketplaceListing[]>([])
  const total = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Filters
  const searchQuery = ref('')
  const collectionFilter = ref('')

  // Creator dashboard
  const creatorListings = ref<MarketplaceListing[]>([])
  const buyerPurchases = ref<MarketplacePurchase[]>([])

  const activeListings = computed(() => listings.value.filter(l => l.isActive))
  const hasListings = computed(() => listings.value.length > 0)

  function setListings(data: MarketplaceListing[], count: number) {
    listings.value = data
    total.value = count
  }

  function setCreatorListings(data: MarketplaceListing[]) {
    creatorListings.value = data
  }

  function setBuyerPurchases(data: MarketplacePurchase[]) {
    buyerPurchases.value = data
  }

  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  function setError(err: string | null) {
    error.value = err
  }

  function clear() {
    listings.value = []
    total.value = 0
    creatorListings.value = []
    buyerPurchases.value = []
    error.value = null
  }

  return {
    listings,
    total,
    isLoading,
    error,
    searchQuery,
    collectionFilter,
    creatorListings,
    buyerPurchases,
    activeListings,
    hasListings,
    setListings,
    setCreatorListings,
    setBuyerPurchases,
    setLoading,
    setError,
    clear,
  }
})
