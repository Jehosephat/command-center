/**
 * Mock for @/lib/galachainClient module
 *
 * Usage in tests:
 * ```ts
 * vi.mock('@/lib/galachainClient', () => mockGalaChainClient)
 * ```
 */
import { vi } from 'vitest';
import type { TokenBalance, TokenClass } from '@gala-chain/connect';
import type { TokenAllowance } from '@gala-chain/api';

/**
 * Mock function implementations
 * Note: fetchBalances and fetchAllowances do NOT take a client parameter (unsigned read operations)
 */
export const mockFetchBalances = vi.fn<[string, any?], Promise<TokenBalance[]>>().mockResolvedValue([]);
export const mockFetchAllowances = vi.fn<[string, any?], Promise<TokenAllowance[]>>().mockResolvedValue([]);
export const mockTransfer = vi.fn<Parameters<any>, Promise<TokenBalance[]>>().mockResolvedValue([]);
export const mockMint = vi.fn<Parameters<any>, Promise<TokenBalance[]>>().mockResolvedValue([]);
export const mockBurn = vi.fn<Parameters<any>, Promise<TokenBalance[]>>().mockResolvedValue([]);
export const mockCreateCollection = vi.fn<Parameters<any>, Promise<TokenClass>>().mockResolvedValue({} as TokenClass);

/**
 * Reset all mock functions
 */
export function resetMockGalaChainClient(): void {
  mockFetchBalances.mockReset().mockResolvedValue([]);
  mockFetchAllowances.mockReset().mockResolvedValue([]);
  mockTransfer.mockReset().mockResolvedValue([]);
  mockMint.mockReset().mockResolvedValue([]);
  mockBurn.mockReset().mockResolvedValue([]);
  mockCreateCollection.mockReset().mockResolvedValue({} as TokenClass);
}

/**
 * Default mock implementation for galachainClient module
 */
export const mockGalaChainClient = {
  fetchBalances: mockFetchBalances,
  fetchAllowances: mockFetchAllowances,
  transfer: mockTransfer,
  mint: mockMint,
  burn: mockBurn,
  createCollection: mockCreateCollection,
  getTokenApiUrl: vi.fn().mockReturnValue('https://galachain-gateway-chain-platform-stage-chain-platform-eks.stage.galachain.com/api/asset/token-contract'),
  createTokenApi: vi.fn(),
  generateUniqueKey: vi.fn().mockReturnValue('test-unique-key'),
};

/**
 * Configure mock to return specific balances
 */
export function setMockBalances(balances: TokenBalance[]): void {
  mockFetchBalances.mockResolvedValue(balances);
}

/**
 * Configure mock to return specific allowances
 */
export function setMockAllowances(allowances: TokenAllowance[]): void {
  mockFetchAllowances.mockResolvedValue(allowances);
}

/**
 * Configure mock transfer to succeed with specific balances
 */
export function setMockTransferSuccess(resultBalances: TokenBalance[] = []): void {
  mockTransfer.mockResolvedValue(resultBalances);
}

/**
 * Configure mock transfer to fail with error
 */
export function setMockTransferError(error: Error | string): void {
  mockTransfer.mockRejectedValue(typeof error === 'string' ? new Error(error) : error);
}

/**
 * Configure mock mint to succeed
 */
export function setMockMintSuccess(resultBalances: TokenBalance[] = []): void {
  mockMint.mockResolvedValue(resultBalances);
}

/**
 * Configure mock mint to fail with error
 */
export function setMockMintError(error: Error | string): void {
  mockMint.mockRejectedValue(typeof error === 'string' ? new Error(error) : error);
}

/**
 * Configure mock burn to succeed
 */
export function setMockBurnSuccess(resultBalances: TokenBalance[] = []): void {
  mockBurn.mockResolvedValue(resultBalances);
}

/**
 * Configure mock burn to fail with error
 */
export function setMockBurnError(error: Error | string): void {
  mockBurn.mockRejectedValue(typeof error === 'string' ? new Error(error) : error);
}

/**
 * Configure mock createCollection to succeed
 */
export function setMockCreateCollectionSuccess(tokenClass: Partial<TokenClass> = {}): void {
  mockCreateCollection.mockResolvedValue(tokenClass as TokenClass);
}

/**
 * Configure mock createCollection to fail with error
 */
export function setMockCreateCollectionError(error: Error | string): void {
  mockCreateCollection.mockRejectedValue(typeof error === 'string' ? new Error(error) : error);
}
