/**
 * Marketplace API client — calls the NestJS backend endpoints
 */

import type {
  MarketplaceListing,
  CreateListingInput,
  UpdateListingInput,
  PurchaseInput,
  MarketplacePurchase,
  ListingsResponse,
  ListingStats,
  CreatorStats,
} from '@shared/types/marketplace'

const BASE = '/api/marketplace'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Request failed: ${response.status}`)
  }

  return response.json()
}

// Listings
export function fetchListings(params?: {
  collection?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<ListingsResponse> {
  const qs = new URLSearchParams()
  if (params?.collection) qs.set('collection', params.collection)
  if (params?.search) qs.set('search', params.search)
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.offset) qs.set('offset', String(params.offset))
  const query = qs.toString()
  return request<ListingsResponse>(`/listings${query ? `?${query}` : ''}`)
}

export function fetchListingById(id: string): Promise<MarketplaceListing> {
  return request<MarketplaceListing>(`/listings/${id}`)
}

export function fetchListingsByCreator(address: string): Promise<MarketplaceListing[]> {
  return request<MarketplaceListing[]>(`/listings/creator/${encodeURIComponent(address)}`)
}

export function createListing(input: CreateListingInput): Promise<MarketplaceListing> {
  return request<MarketplaceListing>('/listings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateListing(id: string, input: UpdateListingInput): Promise<MarketplaceListing> {
  return request<MarketplaceListing>(`/listings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

// Purchases
export function executePurchase(input: PurchaseInput): Promise<MarketplacePurchase> {
  return request<MarketplacePurchase>('/purchase', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function fetchPurchasesByBuyer(address: string): Promise<MarketplacePurchase[]> {
  return request<MarketplacePurchase[]>(`/purchases/buyer/${encodeURIComponent(address)}`)
}

// Stats
export function fetchListingStats(id: string): Promise<ListingStats> {
  return request<ListingStats>(`/stats/listing/${id}`)
}

export function fetchCreatorStats(address: string): Promise<CreatorStats> {
  return request<CreatorStats>(`/stats/creator/${encodeURIComponent(address)}`)
}
