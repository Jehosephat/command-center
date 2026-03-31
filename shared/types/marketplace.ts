/**
 * Shared marketplace types used by both frontend and backend
 */

/** Token class key identifying an NFT or fungible token */
export interface TokenClassKey {
  collection: string
  category: string
  type: string
  additionalKey: string
}

/** A marketplace listing */
export interface MarketplaceListing {
  id: string
  creatorAddress: string
  collection: string
  category: string
  type: string
  additionalKey: string
  priceAmount: string
  priceTokenCollection: string
  priceTokenCategory: string
  priceTokenType: string
  priceTokenAdditionalKey: string
  maxPerWallet: number | null
  totalSupply: number | null
  totalSold: number
  platformFeePercent: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** Input for creating a listing */
export interface CreateListingInput {
  creatorAddress: string
  collection: string
  category: string
  type: string
  additionalKey: string
  priceAmount: string
  priceTokenCollection: string
  priceTokenCategory: string
  priceTokenType: string
  priceTokenAdditionalKey: string
  maxPerWallet?: number
  totalSupply?: number
  platformFeePercent?: number
}

/** Input for updating a listing */
export interface UpdateListingInput {
  creatorAddress: string
  priceAmount?: string
  isActive?: boolean
  maxPerWallet?: number
  totalSupply?: number
}

/** Purchase status */
export type PurchaseStatus = 'pending' | 'payment_verified' | 'minted' | 'failed'

/** A completed or pending purchase */
export interface MarketplacePurchase {
  id: string
  listingId: string
  buyerAddress: string
  quantity: number
  totalPaid: string
  platformFee: string
  sellerReceived: string
  mintedInstances: string | null
  status: PurchaseStatus
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  listing?: MarketplaceListing
}

/** Input for executing a purchase */
export interface PurchaseInput {
  listingId: string
  quantity: number
  buyerAddress: string
  signedTransferDto: Record<string, unknown>
  gatewayUrl: string
}

/** Listing enriched with on-chain token class metadata */
export interface EnrichedListing extends MarketplaceListing {
  name: string
  description: string
  image: string
  symbol: string
}

/** Paginated listings response */
export interface ListingsResponse {
  results: MarketplaceListing[]
  total: number
}

/** Listing stats */
export interface ListingStats {
  totalSold: number
  totalRevenue: string
  totalFees: string
  uniqueBuyers: number
}

/** Creator dashboard stats */
export interface CreatorStats {
  totalListings: number
  activeListings: number
  totalSold: number
  totalRevenue: string
  uniqueBuyers: number
}
