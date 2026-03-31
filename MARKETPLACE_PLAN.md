# Marketplace Feature Plan

## Overview

A mint-on-demand NFT marketplace where creators list their NFT classes for sale and buyers purchase with GalaChain tokens (GALA, GUSDT, etc.). The app backend acts as a fulfiller — verifying payment, splitting fees, and minting NFTs to buyers.

## How It Works

### Creator Flow
1. Creator has already created an NFT collection and class(es) via the Creators page
2. Creator clicks "Sell" on an NFT class, which triggers two actions:
   - **Grant Mint Allowance**: Creator signs a `GrantAllowance` transaction giving the app's fulfiller wallet permission to mint their NFTs (via MetaMask)
   - **Create Listing**: Creator fills in price (in GALA, GUSDT, etc.), purchase limits, and submits to the backend API
3. The listing appears on the marketplace for buyers to browse

### Buyer Flow
1. Buyer browses the marketplace, sees listed NFTs with prices
2. Buyer clicks "Buy", confirms quantity and price breakdown (including platform fee)
3. Buyer signs a single `TransferToken` transaction (via MetaMask) sending the full purchase price to the app's fulfiller wallet
4. The signed transaction is sent to the backend, which:
   - Submits the buyer's payment to GalaChain and verifies success
   - Transfers the seller's portion to the creator's wallet (server-side signing)
   - Mints the NFT(s) to the buyer's wallet (server-side signing, using the granted allowance)
   - Records the sale in the database
5. Buyer sees the minted NFT in their wallet

### Creator Dashboard
- View all active/inactive listings
- See sales stats: total sold, total revenue, unique holders
- Deactivate or update listings

## Architecture Diagram

```
CREATOR (browser + MetaMask):
  1. GrantAllowance(fulfiller wallet) ──────────────→ GalaChain
  2. POST /api/marketplace/listings ────────────────→ Backend (saves to SQLite)

BUYER (browser + MetaMask):
  3. GET /api/marketplace/listings ←────────────────── Backend (reads from SQLite)
  4. Signs TransferToken(totalPrice → fulfiller)
  5. POST /api/marketplace/purchase { signedDTO } ──→ Backend
       │
       ├─→ Submit buyer's transfer to GalaChain ────→ GalaChain ✓ payment verified
       ├─→ Transfer sellerAmount to creator ────────→ GalaChain (server-side signed)
       ├─→ MintTokenWithAllowance to buyer ─────────→ GalaChain (server-side signed)
       ├─→ Record purchase in SQLite
       └─→ Return minted NFT info to buyer
```

### Why Buyer Pays the Fulfiller Wallet (Not Seller Directly)

- **Atomic verification**: Backend controls when the transfer is submitted, so verification is built-in (GalaChain returns Status:1 on success)
- **Single MetaMask popup**: Buyer signs one transaction, not two
- **Fee split handled server-side**: Backend distributes funds after receiving them — no race conditions between seller payment and platform fee

## Database

**SQLite** via `better-sqlite3` + **TypeORM** — fits the single-service Railway deployment with no additional infrastructure. TypeORM's abstraction allows migrating to PostgreSQL later by swapping the driver config.

### Listing Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| creatorAddress | varchar | Creator's GalaChain address (`eth|...`) |
| collection | varchar | NFT collection name |
| category | varchar | Token class category |
| type | varchar | Token class type |
| additionalKey | varchar | Token class additional key |
| name | varchar | Display name for the listing |
| description | text | Listing description |
| image | varchar | Image URL |
| priceAmount | varchar | Price per NFT as string (e.g. `"10"`) |
| priceTokenCollection | varchar | Payment token collection (e.g. `"GALA"`) |
| priceTokenCategory | varchar | Payment token category |
| priceTokenType | varchar | Payment token type |
| priceTokenAdditionalKey | varchar | Payment token additional key |
| maxPerWallet | int (nullable) | Max purchases per buyer wallet (null = unlimited) |
| totalSupply | int (nullable) | Total available for sale (null = unlimited, bounded by allowance) |
| totalSold | int (default 0) | Number of successful purchases |
| platformFeePercent | decimal(5,2) | Platform fee % (e.g. `2.50`) |
| isActive | boolean (default true) | Whether listing is currently purchasable |
| createdAt | datetime | |
| updatedAt | datetime | |

### Purchase Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| listingId | uuid (FK) | References Listing |
| buyerAddress | varchar | Buyer's GalaChain address |
| quantity | int | Number of NFTs purchased |
| totalPaid | varchar | Total payment amount (string) |
| platformFee | varchar | Platform fee portion (string) |
| sellerReceived | varchar | Amount received by seller (string) |
| paymentTxSignature | text | Buyer's signed transfer DTO (for verification) |
| mintedInstances | text (nullable) | JSON array of minted token instance IDs |
| status | enum | `pending`, `payment_verified`, `minted`, `failed` |
| errorMessage | text (nullable) | Error details if status is `failed` |
| createdAt | datetime | |
| updatedAt | datetime | |

## Server-Side Signing

The backend needs to sign GalaChain transactions using the fulfiller wallet's private key. This follows the pattern used in the [gala-faucet](https://github.com/Jehosephat/gala-faucet) reference implementation:

- **Libraries**: `elliptic` (secp256k1), `js-sha3` (keccak256), `json-stringify-deterministic`
- **Signature format**: DER encoded as base64 (GalaChain accepts both DER and compact Ethereum signatures)
- **No prefix field** — only browser signing uses the Ethereum personal message prefix

### GalaChainSignerService

A NestJS injectable service that encapsulates all server-side signing:

| Method | Description |
|--------|-------------|
| `signDto(dto)` | Sign any DTO with the fulfiller private key |
| `submitSigned(method, dto)` | Sign and POST to GalaChain gateway |
| `mintToOwner(tokenClass, owner, quantity)` | Mint NFTs using `MintTokenWithAllowance` |
| `transferToken(from, to, tokenInstance, quantity)` | Transfer tokens between addresses |

## Environment Variables

New variables added to the server configuration:

```env
# Fulfiller wallet (server-side signing)
FULFILLER_PRIVATE_KEY=<64-character hex string, no 0x prefix>
FULFILLER_ADDRESS=eth|<address derived from private key>

# Platform fee
PLATFORM_FEE_PERCENT=2.5

# Database
DATABASE_PATH=./data/marketplace.sqlite
```

The fulfiller address doubles as the platform wallet — platform fees remain in the fulfiller wallet's balance.

## Backend API Endpoints

All under `/api/marketplace`:

### Listings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/listings` | None | Browse active listings (paginated, filterable by collection) |
| GET | `/listings/:id` | None | Get single listing with stats |
| POST | `/listings` | Wallet address | Create a new listing |
| PATCH | `/listings/:id` | Wallet address | Update listing (deactivate, change price) |
| GET | `/listings/creator/:address` | None | Get all listings by a creator |

### Purchases

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/purchase` | Signed DTO | Execute a purchase (buyer submits signed transfer) |
| GET | `/purchases/buyer/:address` | None | Buyer's purchase history |

### Stats

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stats/listing/:id` | None | Sales stats for a listing |
| GET | `/stats/creator/:address` | None | Creator dashboard stats (total sales, revenue, holders) |

### Purchase Endpoint Detail (`POST /api/marketplace/purchase`)

**Request body**: `{ listingId, quantity, signedTransferDto }`

**Flow**:
1. Validate listing exists, is active, has supply remaining
2. Validate quantity against `maxPerWallet` and remaining supply (`totalSupply - totalSold`)
3. Validate the signed transfer DTO:
   - `dto.to` must equal `FULFILLER_ADDRESS`
   - `dto.quantity` must equal `priceAmount * quantity`
   - Token instance must match the listing's payment token
4. Submit buyer's signed transfer DTO to GalaChain gateway
5. If transfer succeeds (Status:1):
   - Record Purchase with status `payment_verified`
   - Server-sign and submit transfer of `sellerAmount` to creator address
   - Server-sign and submit `MintTokenWithAllowance` to mint NFT(s) to buyer
   - Update Purchase with minted instance IDs, set status to `minted`
   - Increment `listing.totalSold`
   - Return success with minted NFT details
6. If transfer fails: Record Purchase as `failed` with error, return error to buyer
7. If mint fails after payment: Purchase stays at `payment_verified` for admin retry

## Frontend: New GalaChain Client Method

### GrantAllowance

Added to `client/src/lib/galachainClient.ts`:

```typescript
grantAllowance(client, {
  tokenInstance: { collection, category, type, additionalKey, instance: '0' },
  quantities: [{ user: fulfillerAddress, quantity: allowanceAmount }],
  allowanceType: 4,  // AllowanceType.Mint
  uses: '0',         // unlimited uses
})
```

This is a signed operation (MetaMask popup). The creator grants the fulfiller wallet permission to mint their NFTs.

## Frontend: New Pages

### Routes (under Layout)

| Route | View | Description |
|-------|------|-------------|
| `/marketplace` | MarketplaceView | Browse listings grid with search/filter |
| `/marketplace/:id` | ListingDetailView | Full listing detail page with Buy button |
| `/marketplace/create` | CreateListingView | Two-step: grant allowance then submit listing |
| `/marketplace/dashboard` | CreatorDashboardView | Creator's sales stats and listing management |

**Navigation**: Add "Marketplace" tab between "Creators" and "Export"

## Frontend: New Files

### Shared Types
- `shared/types/marketplace.ts` — Listing, Purchase, API request/response interfaces

### Pinia Store
- `client/src/stores/marketplace.ts` — Listings state, filters, purchase state

### Composables
- `useMarketplace.ts` — Browse/search/filter listings
- `useCreateListing.ts` — Grant allowance + create listing flow
- `usePurchase.ts` — Purchase flow (sign transfer + submit to backend)
- `useGrantAllowance.ts` — GrantAllowance wrapper
- `useCreatorDashboard.ts` — Stats + listing management

### Components
- `marketplace/ListingCard.vue` — Grid card showing NFT image, name, price
- `marketplace/ListingGrid.vue` — Responsive grid layout
- `marketplace/PurchaseModal.vue` — Buy confirmation with price breakdown
- `marketplace/CreateListingForm.vue` — Multi-step listing creation
- `marketplace/PriceDisplay.vue` — Price with token icon
- `marketplace/SalesStatsCard.vue` — Stats card for dashboard

### Backend Modules
- `src/modules/marketplace/` — Controller, service, entities, DTOs
- `src/modules/galachain/` — Server-side signing service, gateway client

## Implementation Phases

### Phase 1: Backend Foundation
- Install dependencies: `typeorm`, `@nestjs/typeorm`, `better-sqlite3`, `elliptic`, `js-sha3`, `json-stringify-deterministic`
- Create TypeORM entities (Listing, Purchase)
- Configure TypeORM in AppModule with SQLite
- Create GalaChainSignerService (server-side signing)
- Create GalaChainGatewayService (submit signed DTOs to gateway)
- Extend `configuration.ts` with new environment variables

### Phase 2: Backend API
- Create MarketplaceModule with controller, service, validation DTOs
- Implement listing CRUD endpoints
- Implement purchase endpoint with full flow (validate, transfer, mint, record)
- Implement stats endpoints

### Phase 3: Frontend Core
- Add `grantAllowance()` to galachainClient.ts
- Create shared marketplace types
- Create `useGrantAllowance` composable

### Phase 4: Frontend Marketplace UI
- Create marketplace Pinia store and composables
- Create listing card, grid, and filter components
- Create purchase modal with price breakdown
- Create listing creation form (two-step flow)
- Create marketplace views and add routes
- Add navigation item

### Phase 5: Creator Dashboard & Polish
- Creator dashboard with sales stats, holder info, listing management
- Error handling with toast notifications
- Loading states and skeleton loaders
- End-to-end testing on testnet

## Failure Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| Payment succeeds but mint fails | Purchase stays at `payment_verified`. Admin can retry mint. Fulfiller has the funds. |
| Fulfiller has insufficient mint allowance | Backend checks allowance before accepting purchase. Returns error before payment. |
| Buyer has insufficient token balance | GalaChain rejects the transfer (Status:0). No funds move. |
| Listing sold out | Backend checks `totalSold < totalSupply` before processing. |
| Max per wallet exceeded | Backend counts existing purchases by buyer address. |
| GalaChain gateway down | Clear error message to buyer. No funds at risk (transfer not submitted). |
| Concurrent purchases on last item | TypeORM transaction with optimistic locking on `totalSold`. |

## Security Considerations

- **Fulfiller private key** is stored only in environment variables (Railway secrets), never in code or client bundle
- **Buyer payment verification** is inherent — backend submits the signed transfer and checks GalaChain's response
- **DTO validation** ensures the signed transfer matches expected recipient, amount, and token type
- **uniqueKey** in every write DTO prevents replay attacks
- **All numeric values as strings** in DTOs (codebase convention to avoid BigNumber serialization bugs)
