/**
 * GalaChain client module for chaincode interactions
 *
 * This module provides typed methods for interacting with GalaChain:
 * - Read operations (FetchBalances, FetchAllowances) - No signing required
 * - Write operations (Transfer, Mint, Burn) - Require wallet signing via BrowserConnectClient
 *
 * Signed operations use client.sign() + direct fetch POST, bypassing the SDK's
 * submit() pipeline (which has issues with instanceToPlain and BigNumber serialization).
 */

import { BrowserConnectClient } from '@gala-chain/connect'
import type { TokenBalance, TokenInstanceKey, TokenClassKey, TokenClass } from '@gala-chain/connect'
import type { TokenAllowance, FetchAllowancesResponse, UserRef, TokenBalanceWithMetadata, FetchBalancesWithTokenMetadataResponse } from '@gala-chain/api'
import BigNumber from 'bignumber.js'
import { useNetworkStore } from '@/stores/network'
import { GalaChainError, logError } from './galachainErrors'

/**
 * Get the token API URL based on selected network
 * Reads from the network store for runtime network switching
 */
export function getTokenApiUrl(): string {
  const networkStore = useNetworkStore()
  return networkStore.gatewayUrl
}

/**
 * Token instance input for operations (accepts both BigNumber and primitives)
 */
export interface TokenInstanceInput {
  collection: string
  category: string
  type: string
  additionalKey: string
  instance: BigNumber | string | number
}

/**
 * Generate a unique key for submit DTOs
 * This ensures each transaction is unique and prevents replay attacks
 */
function generateUniqueKey(): string {
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  return btoa(String.fromCharCode(...randomBytes))
}

/**
 * Log request/response in development mode
 */
function logRequest(method: string, dto: unknown): void {
  if (import.meta.env.DEV) {
    console.log(`[GalaChain] ${method}`, dto)
  }
}

function logResponse<T>(method: string, response: T): void {
  if (import.meta.env.DEV) {
    console.log(`[GalaChain] ${method} response:`, response)
  }
}

// ============================================================================
// Shared HTTP + Error Handling
// ============================================================================

/**
 * GalaChain API response structure
 */
interface GalaChainResponse<T> {
  Status: number
  Data?: T
  Message?: string
  Error?: string
  ErrorCode?: number
}

/**
 * POST a payload to a GalaChain method and parse the response.
 * Used by both unsigned reads and signed writes.
 */
async function post<T>(method: string, payload: object): Promise<T> {
  const url = `${getTokenApiUrl()}/${method}`

  logRequest(method, payload)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      let errorBody = ''
      try {
        errorBody = await response.text()
        console.error(`[GalaChain:${method}] Error response body:`, errorBody)
      } catch {
        // Ignore if we can't read the body
      }
      throw new GalaChainError(
        `HTTP error: ${response.status} ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`,
        'NETWORK_ERROR'
      )
    }

    const result: GalaChainResponse<T> = await response.json()

    logResponse(method, result)

    if (result.Status !== 1) {
      throw new GalaChainError(
        result.Message || result.Error || `Operation failed with status ${result.Status}`,
        result.Error || 'API_ERROR',
        undefined,
        { errorCode: result.ErrorCode }
      )
    }

    return result.Data as T
  } catch (err) {
    logError(method, err)

    if (err instanceof GalaChainError) {
      throw err
    }

    if (err instanceof Error) {
      const message = err.message.toLowerCase()
      if (err.name === 'TypeError' && message.includes('fetch')) {
        throw new GalaChainError(
          'Unable to connect to GalaChain. Please check your network connection.',
          'NETWORK_ERROR'
        )
      }
      if (message.includes('user rejected') || message.includes('user denied')) {
        throw new GalaChainError(
          'Transaction was rejected. Please approve the transaction in your wallet to continue.',
          'USER_REJECTED'
        )
      }
      throw new GalaChainError(err.message, 'UNKNOWN_ERROR')
    }

    throw new GalaChainError('An unexpected error occurred.', 'UNKNOWN_ERROR')
  }
}

/**
 * Sign a DTO with the wallet, then POST to the gateway.
 * This bypasses the SDK's submit() pipeline entirely.
 */
async function signAndPost<T>(client: BrowserConnectClient, method: string, dto: object): Promise<T> {
  const signedDto = await client.sign(method, dto)
  return post<T>(method, signedDto)
}

// ============================================================================
// Unsigned Read Operations (No wallet required)
// ============================================================================

/**
 * Fetch token balances for an address
 */
export async function fetchBalances(
  owner: string,
  filters?: {
    collection?: string
    category?: string
    type?: string
    additionalKey?: string
  }
): Promise<TokenBalance[]> {
  return post<TokenBalance[]>('FetchBalances', {
    owner: owner as UserRef,
    ...filters,
  })
}

/**
 * Fetch token balances with metadata (includes token class info like name, symbol, image)
 */
export async function fetchBalancesWithMetadata(
  owner: string,
  filters?: {
    collection?: string
    category?: string
    type?: string
    additionalKey?: string
  }
): Promise<TokenBalanceWithMetadata[]> {
  const response = await post<FetchBalancesWithTokenMetadataResponse>(
    'FetchBalancesWithTokenMetadata',
    { owner: owner as UserRef, ...filters }
  )
  return response.results || []
}

/**
 * Fetch token allowances for an address
 */
export async function fetchAllowances(
  grantedTo: string,
  filters?: {
    collection?: string
    category?: string
    type?: string
    additionalKey?: string
    grantedBy?: string
  }
): Promise<TokenAllowance[]> {
  const dto = {
    grantedTo: grantedTo as UserRef,
    ...(filters?.collection && { collection: filters.collection }),
    ...(filters?.category && { category: filters.category }),
    ...(filters?.type && { type: filters.type }),
    ...(filters?.additionalKey && { additionalKey: filters.additionalKey }),
    ...(filters?.grantedBy && { grantedBy: filters.grantedBy as UserRef }),
  }

  const response = await post<FetchAllowancesResponse>('FetchAllowances', dto)
  return response.results || []
}

// ============================================================================
// Signed Write Operations (Wallet required)
// ============================================================================

/**
 * Transfer tokens to another address
 */
export async function transfer(
  client: BrowserConnectClient,
  from: string,
  to: string,
  tokenInstance: TokenInstanceInput,
  quantity: BigNumber | string | number
): Promise<TokenBalance[]> {
  const dto = {
    from: from as UserRef,
    to: to as UserRef,
    tokenInstance: {
      collection: tokenInstance.collection,
      category: tokenInstance.category,
      type: tokenInstance.type,
      additionalKey: tokenInstance.additionalKey,
      instance: new BigNumber(tokenInstance.instance).toString(),
    },
    quantity: new BigNumber(quantity).toString(),
    uniqueKey: generateUniqueKey(),
  }

  return signAndPost<TokenBalance[]>(client, 'TransferToken', dto)
}

/**
 * Mint tokens with allowance (grants allowance and mints in a single transaction).
 * Requires the caller to be a token authority for the collection.
 */
export async function mint(
  client: BrowserConnectClient,
  tokenClass: {
    collection: string
    category: string
    type: string
    additionalKey: string
  },
  owner: string,
  quantity: BigNumber | string | number
): Promise<TokenInstanceKey[]> {
  const dto = {
    tokenClass,
    tokenInstance: '0',
    owner: owner as UserRef,
    quantity: new BigNumber(quantity).toString(),
    uniqueKey: generateUniqueKey(),
  }

  return signAndPost<TokenInstanceKey[]>(client, 'MintTokenWithAllowance', dto)
}

/**
 * Burn tokens (requires burn authority or ownership)
 */
export async function burn(
  client: BrowserConnectClient,
  tokenInstances: Array<{
    tokenInstanceKey: TokenInstanceInput
    quantity: BigNumber | string | number
  }>
): Promise<unknown[]> {
  const dto = {
    tokenInstances: tokenInstances.map(item => ({
      tokenInstanceKey: {
        collection: item.tokenInstanceKey.collection,
        category: item.tokenInstanceKey.category,
        type: item.tokenInstanceKey.type,
        additionalKey: item.tokenInstanceKey.additionalKey,
        instance: new BigNumber(item.tokenInstanceKey.instance).toString(),
      },
      quantity: new BigNumber(item.quantity).toString(),
    })),
    uniqueKey: generateUniqueKey(),
  }

  return signAndPost<unknown[]>(client, 'BurnTokens', dto)
}

/**
 * Grant a mint allowance to another address (e.g. the fulfiller wallet).
 * The caller must be a token authority for the specified token class.
 */
export async function grantAllowance(
  client: BrowserConnectClient,
  params: {
    tokenInstance: {
      collection: string
      category: string
      type: string
      additionalKey: string
      instance?: string
    }
    grantedTo: string
    quantity: BigNumber | string | number
    allowanceType: number
    uses?: BigNumber | string | number
    expires?: number
  }
): Promise<unknown> {
  const dto = {
    tokenInstance: {
      ...params.tokenInstance,
      instance: params.tokenInstance.instance ?? '0',
    },
    quantities: [{
      user: params.grantedTo,
      quantity: new BigNumber(params.quantity).toString(),
    }],
    allowanceType: params.allowanceType,
    uses: new BigNumber(params.uses && params.uses !== '0' ? params.uses : '1000000').toString(),
    ...(params.expires !== undefined && { expires: params.expires }),
    uniqueKey: generateUniqueKey(),
  }

  return signAndPost(client, 'GrantAllowance', dto)
}

// ============================================================================
// Token Class Operations
// ============================================================================

/**
 * Input for creating a new token class/collection
 */
export interface CreateTokenClassInput {
  tokenClass: {
    collection: string
    category: string
    type: string
    additionalKey: string
  }
  name: string
  symbol: string
  description: string
  image: string
  isNonFungible?: boolean
  decimals?: number
  maxSupply?: BigNumber | string | number
  maxCapacity?: BigNumber | string | number
  rarity?: string
  authorities?: string[]
}

/**
 * Create a new token class/collection
 */
export async function createCollection(
  client: BrowserConnectClient,
  input: CreateTokenClassInput
): Promise<TokenClass> {
  const dto = {
    tokenClass: {
      collection: input.tokenClass.collection,
      category: input.tokenClass.category,
      type: input.tokenClass.type,
      additionalKey: input.tokenClass.additionalKey,
    },
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image: input.image,
    isNonFungible: input.isNonFungible ?? true,
    decimals: input.decimals ?? 0,
    uniqueKey: generateUniqueKey(),
    ...(input.maxSupply !== undefined && isFinite(Number(input.maxSupply)) && Number(input.maxSupply) > 0 && { maxSupply: new BigNumber(input.maxSupply).toString() }),
    ...(input.maxCapacity !== undefined && isFinite(Number(input.maxCapacity)) && Number(input.maxCapacity) > 0 && { maxCapacity: new BigNumber(input.maxCapacity).toString() }),
    ...(input.rarity && { rarity: input.rarity }),
    ...(input.authorities && input.authorities.length > 0 && { authorities: input.authorities }),
  }

  return signAndPost<TokenClass>(client, 'CreateTokenClass', dto)
}

// ============================================================================
// NFT Collection Authorization Operations
// ============================================================================

export interface NftCollectionAuthorization {
  collection: string
  authorizedUsers: string[]
}

export interface FetchNftCollectionAuthorizationsResponse {
  results: NftCollectionAuthorization[]
  nextPageBookmark?: string
}

export interface CreateNftCollectionInput {
  collection: string
  category: string
  type: string
  additionalKey: string
  name: string
  symbol: string
  description: string
  image: string
  metadataAddress?: string
  contractAddress?: string
  rarity?: string
  maxSupply?: BigNumber | string | number
  maxCapacity?: BigNumber | string | number
  authorities?: string[]
}

/**
 * Fetch NFT collection authorizations
 */
export async function fetchNftCollectionAuthorizations(
  options?: {
    bookmark?: string
    limit?: number
  }
): Promise<FetchNftCollectionAuthorizationsResponse> {
  const dto = {
    ...(options?.bookmark && { bookmark: options.bookmark }),
    ...(options?.limit && { limit: options.limit }),
  }

  return post<FetchNftCollectionAuthorizationsResponse>(
    'FetchNftCollectionAuthorizationsWithPagination',
    dto
  )
}

/**
 * Grant NFT collection authorization (claim a collection name)
 */
export async function grantNftCollectionAuthorization(
  client: BrowserConnectClient,
  collection: string,
  authorizedUser: string
): Promise<unknown> {
  const dto = {
    collection,
    authorizedUser: authorizedUser as UserRef,
    uniqueKey: generateUniqueKey(),
  }

  return signAndPost(client, 'GrantNftCollectionAuthorization', dto)
}

/**
 * Create an NFT collection from a claimed authorization
 */
export async function createNftCollection(
  client: BrowserConnectClient,
  input: CreateNftCollectionInput
): Promise<TokenClass> {
  const dto = {
    collection: input.collection,
    category: input.category,
    type: input.type,
    additionalKey: input.additionalKey,
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image: input.image,
    uniqueKey: generateUniqueKey(),
    ...(input.metadataAddress && { metadataAddress: input.metadataAddress }),
    ...(input.contractAddress && { contractAddress: input.contractAddress }),
    ...(input.rarity && { rarity: input.rarity }),
    ...(input.maxSupply !== undefined && isFinite(Number(input.maxSupply)) && Number(input.maxSupply) > 0 && { maxSupply: new BigNumber(input.maxSupply).toString() }),
    ...(input.maxCapacity !== undefined && isFinite(Number(input.maxCapacity)) && Number(input.maxCapacity) > 0 && { maxCapacity: new BigNumber(input.maxCapacity).toString() }),
    ...(input.authorities && input.authorities.length > 0 && {
      authorities: input.authorities.map(a => a as UserRef)
    }),
  }

  return signAndPost<TokenClass>(client, 'CreateNftCollection', dto)
}

// ============================================================================
// Token Class Queries
// ============================================================================

/**
 * Response from FetchTokenClassesWithPagination
 */
export interface FetchTokenClassesResponse {
  results: TokenClass[]
  nextPageBookmark?: string
}

/**
 * Fetch token classes for a collection (with optional filters and pagination).
 * This is a read-only operation that does NOT require wallet signing.
 */
export async function fetchTokenClasses(
  filters: {
    collection: string
    category?: string
    type?: string
    additionalKey?: string
  },
  options?: {
    bookmark?: string
    limit?: number
  }
): Promise<FetchTokenClassesResponse> {
  const dto = {
    collection: filters.collection,
    ...(filters.category && { category: filters.category }),
    ...(filters.type && { type: filters.type }),
    ...(filters.additionalKey && { additionalKey: filters.additionalKey }),
    ...(options?.bookmark && { bookmark: options.bookmark }),
    ...(options?.limit && { limit: options.limit }),
  }

  return post<FetchTokenClassesResponse>('FetchTokenClassesWithPagination', dto)
}

// ============================================================================
// Environment Configuration Export
// ============================================================================

export function getGalaChainConfig() {
  const networkStore = useNetworkStore()
  return {
    env: networkStore.network,
    gatewayUrl: networkStore.gatewayUrl,
  }
}

/**
 * Re-export types for convenience
 */
export type { TokenBalance, TokenInstanceKey, TokenClassKey, TokenClass, TokenBalanceWithMetadata }
