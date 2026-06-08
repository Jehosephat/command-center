// UI display interfaces - shared between backend and frontend
// These interfaces represent how data is displayed to users
//
// Note: We use strings for numeric values to avoid Vue reactivity issues with BigNumber instances.
// The store converts BigNumber to string when creating display objects.

import { AllowanceType } from '@gala-chain/api';

// Re-export imports used in interfaces to ensure they're recognized as used
export { AllowanceType };

/**
 * Display format for a fungible token
 */
export interface FungibleTokenDisplay {
  /** Unique identifier for the token (collection|category|type|additionalKey) */
  tokenKey: string;
  /** Token collection name */
  collection: string;
  /** Token category */
  category: string;
  /** Token type */
  type: string;
  /** Additional key for uniqueness */
  additionalKey: string;
  /** Human-readable token name */
  name: string;
  /** Token symbol (e.g., GALA) */
  symbol: string;
  /** Token description */
  description: string;
  /** Token image URL */
  image: string;
  /** Number of decimal places */
  decimals: number;
  /** Total balance owned (raw string) */
  balanceRaw: string;
  /** Formatted balance string for display */
  balanceFormatted: string;
  /** Locked balance amount (raw string) */
  lockedBalanceRaw: string;
  /** Locked balance formatted */
  lockedBalanceFormatted: string;
  /** Spendable balance amount (raw string) */
  spendableBalanceRaw: string;
  /** Spendable balance formatted */
  spendableBalanceFormatted: string;
  /** Whether user has mint authority for this token */
  canMint: boolean;
  /** Whether user can burn this token (owns tokens OR has burn authority) */
  canBurn: boolean;
  /** Remaining mint allowance if canMint is true (raw string) */
  mintAllowanceRaw?: string;
  /** Remaining mint allowance formatted */
  mintAllowanceFormatted?: string;
}

/**
 * Display format for an NFT
 */
export interface NFTDisplay {
  /** Unique identifier for the NFT instance (includes channel prefix) */
  instanceKey: string;
  /** GalaChain channel this NFT lives on (e.g. 'asset', 'mirandus') */
  channel: string;
  /** Token collection name */
  collection: string;
  /** Token category */
  category: string;
  /** Token type */
  type: string;
  /** Additional key for uniqueness */
  additionalKey: string;
  /** NFT instance ID (string representation) */
  instance: string;
  /** Human-readable token name */
  name: string;
  /** Token symbol */
  symbol: string;
  /** Token description */
  description: string;
  /** NFT image URL */
  image: string;
  /** Token rarity if applicable */
  rarity?: string;
  /** Whether the NFT is currently locked */
  isLocked: boolean;
  /** Whether the NFT is currently in use */
  isInUse: boolean;
  /** Whether user can transfer this NFT */
  canTransfer: boolean;
  /** Whether user has burn authority for this NFT */
  canBurn: boolean;
}

/**
 * Display format for an NFT collection
 */
export interface CollectionDisplay {
  /** Unique identifier for the collection (collection|category|type|additionalKey) */
  collectionKey: string;
  /** Collection name */
  collection: string;
  /** Category within the collection */
  category: string;
  /** Type within the category */
  type: string;
  /** Additional key */
  additionalKey: string;
  /** Human-readable collection name */
  name: string;
  /** Collection symbol */
  symbol: string;
  /** Collection description */
  description: string;
  /** Collection image URL */
  image: string;
  /** Whether this is an NFT collection (non-fungible) */
  isNonFungible: boolean;
  /** Maximum supply (0 = unlimited) - string representation */
  maxSupply: string;
  /** Current total supply - string representation */
  totalSupply: string;
  /** Total burned - string representation */
  totalBurned: string;
  /** Whether the current user is an authority for this collection */
  isAuthority: boolean;
  /** Number of items owned by current user */
  ownedCount: number;
}

/**
 * Display format for a token allowance
 */
export interface AllowanceDisplay {
  /** Unique identifier for the allowance */
  allowanceKey: string;
  /** Token collection */
  collection: string;
  /** Token category */
  category: string;
  /** Token type */
  type: string;
  /** Additional key */
  additionalKey: string;
  /** Instance ID (for NFT allowances) - string representation */
  instance: string;
  /** Type of allowance (Mint, Burn, Transfer, etc.) */
  allowanceType: AllowanceType;
  /** Who granted the allowance */
  grantedBy: string;
  /** Who received the allowance */
  grantedTo: string;
  /** Total quantity allowed (raw string) */
  quantityRaw: string;
  /** Quantity already spent (raw string) */
  quantitySpentRaw: string;
  /** Remaining quantity (raw string) */
  quantityRemainingRaw: string;
  /** Formatted remaining quantity for display */
  quantityRemainingFormatted: string;
  /** Number of uses allowed (raw string) */
  usesRaw: string;
  /** Number of uses spent (raw string) */
  usesSpentRaw: string;
  /** Expiration timestamp (0 = never) */
  expires: number;
  /** Whether the allowance has expired */
  isExpired: boolean;
  /** Human-readable expiration date */
  expiresFormatted: string;
}

/**
 * Result of a transaction operation
 */
export interface TransactionResult {
  /** Whether the transaction was successful */
  success: boolean;
  /** Transaction hash if available */
  transactionHash?: string;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: number;
  /** Timestamp of the transaction */
  timestamp: number;
  /** Type of transaction (transfer, mint, burn, etc.) */
  transactionType: TransactionType;
  /** Human-readable description of what happened */
  description: string;
}

/**
 * Types of transactions in the app
 */
export enum TransactionType {
  Transfer = 'transfer',
  Mint = 'mint',
  Burn = 'burn',
  CreateCollection = 'create_collection',
  CreateClass = 'create_class',
  GrantAllowance = 'grant_allowance',
  RevokeAllowance = 'revoke_allowance',
  Lock = 'lock',
  Unlock = 'unlock',
}

/**
 * Status of a pending transaction
 */
export enum TransactionStatus {
  Pending = 'pending',
  Confirming = 'confirming',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

/**
 * Pending transaction tracking
 */
export interface PendingTransaction {
  /** Unique ID for tracking */
  id: string;
  /** Type of transaction */
  type: TransactionType;
  /** Current status */
  status: TransactionStatus;
  /** When the transaction was initiated */
  timestamp: number;
  /** Transaction hash if available */
  hash?: string;
  /** Human-readable description */
  description: string;
  /** Error message if failed */
  error?: string;
}
