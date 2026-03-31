import { ref, computed } from 'vue'
import * as api from '@/lib/marketplaceApi'
import { fetchTokenClasses } from '@/lib/galachainClient'
import type { MarketplaceListing, EnrichedListing } from '@shared/types/marketplace'

export function useMarketplace() {
  const enrichedListings = ref<EnrichedListing[]>([])
  const total = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Enrich a listing with on-chain token class metadata
   */
  async function enrichListing(listing: MarketplaceListing): Promise<EnrichedListing> {
    try {
      const response = await fetchTokenClasses({
        collection: listing.collection,
        category: listing.category,
        type: listing.type,
        additionalKey: listing.additionalKey,
      })
      const tokenClass = response.results[0]
      if (tokenClass) {
        return {
          ...listing,
          name: tokenClass.name || listing.type || 'Unnamed',
          description: tokenClass.description || '',
          image: tokenClass.image || '',
          symbol: tokenClass.symbol || '',
        }
      }
    } catch {
      // Fall back to key-based display
    }
    return {
      ...listing,
      name: `${listing.collection} / ${listing.type}`,
      description: '',
      image: '',
      symbol: '',
    }
  }

  async function fetchListings(params?: { collection?: string; search?: string; limit?: number; offset?: number }) {
    isLoading.value = true
    error.value = null
    try {
      const data = await api.fetchListings(params)
      total.value = data.total

      // Enrich all listings with chain data in parallel
      enrichedListings.value = await Promise.all(data.results.map(enrichListing))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load listings'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAndEnrichListing(id: string): Promise<EnrichedListing | null> {
    try {
      const listing = await api.fetchListingById(id)
      return enrichListing(listing)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load listing'
      return null
    }
  }

  return {
    listings: computed(() => enrichedListings.value),
    total: computed(() => total.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    fetchListings,
    fetchAndEnrichListing,
    enrichListing,
  }
}
