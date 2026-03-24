# AGENTS.md

## Project Overview

GalaChain Command Center - A lightweight dApp for GalaChain token operations (fungible tokens, NFTs, creator tools).

## Stack

- **Backend**: NestJS + TypeScript
- **Frontend**: Vue 3 + Vite + TypeScript
- **State Management**: Pinia
- **Styling**: Tailwind CSS
- **Form Validation**: VeeValidate + zod
- **Wallet Connection**: @gala-chain/connect (^2.3.0, installed as v2.7.1)
- **Chain API**: @gala-chain/api (^2.3.0)
- **BigNumber**: bignumber.js (^9.3.1)

## Project Structure

```
command-center/
├── src/                          # NestJS backend
├── client/                       # Vue 3 frontend
│   └── src/
│       ├── lib/
│       │   ├── galachainClient.ts   # All GalaChain API calls (read + write)
│       │   └── galachainErrors.ts   # Error types and user-friendly messages
│       ├── stores/
│       │   ├── wallet.ts            # MetaMask connection + sign override
│       │   └── network.ts           # Mainnet/testnet switching
│       └── composables/             # Vue composables
├── shared/                       # Shared types (imported by both)
├── dist/                         # NestJS build output
└── dist/client/                  # Vue build output (served by NestJS)
```

This is a single deployable unit. NestJS serves the Vue static build for all non-API routes.

## Patterns

### Deployment
- This codebase deploys to Railway as a single service
- NestJS serves API routes at `/api/*` and Vue static files for everything else
- Build order: Vue builds first to `dist/client/`, then NestJS builds to `dist/`

### Frontend Architecture
- This codebase uses Pinia stores for state management (not Vuex)
- This codebase uses Vue composables (`use*.ts`) for reusable logic
- Always put Vue composables in `client/src/composables/`
- Always put Pinia stores in `client/src/stores/`
- Always put shared types in `shared/` so both frontend and backend can import them

### Testing
- Always mock `@gala-chain/connect` and the GalaChain client in automated tests
- Use `@pinia/testing` with `createTestingPinia()` to mock stores in component tests
- For E2E tests, inject mock wallet state via `window.__MOCK_WALLET__`
- Tasks involving wallet connection or transaction signing require manual testing
- Integration tests for read operations can use a provided test wallet address

### Forms
- This codebase uses VeeValidate for form handling in Vue components
- Always define validation schemas with zod, then use `@vee-validate/zod` to integrate

### API Design
- Frontend talks directly to GalaChain for most operations (no backend proxy)
- NestJS `/api` routes are reserved for features requiring backend processing

---

## GalaChain Integration

### Gateway URLs

Defined in `client/src/stores/network.ts`. User can toggle at runtime.

- **Mainnet**: `https://gateway-mainnet.galachain.com/api/asset/token-contract`
- **Testnet**: `https://gateway-testnet.galachain.com/api/testnet01/gc-a9b8b472b035c0510508c248d1110d3162b7e5f4-GalaChainToken`

All API calls are `POST {gatewayUrl}/{MethodName}` with a JSON body.

### Address Format

GalaChain uses `eth|`-prefixed addresses (e.g. `eth|D1499B10A0e1F4912FD1d771b183DfDfBDF766DC`), not `0x`-prefixed. When working with MetaMask addresses, convert: `eth|${address.slice(2)}`. The `BrowserConnectClient.connect()` method returns the address already in `eth|` format.

### API Methods

All methods are POST requests. The response shape is `{ Status: number, Data?: T, Message?: string, Error?: string, ErrorCode?: number }`. `Status === 1` means success.

#### Read Operations (unsigned, no wallet needed)

| Method | DTO fields | Returns |
|--------|-----------|---------|
| `FetchBalances` | `{ owner }` | `TokenBalance[]` |
| `FetchBalancesWithTokenMetadata` | `{ owner }` | `{ results: TokenBalanceWithMetadata[] }` |
| `FetchAllowances` | `{ grantedTo, collection?, category?, type?, additionalKey?, grantedBy? }` | `{ results: TokenAllowance[] }` |
| `FetchNftCollectionAuthorizationsWithPagination` | `{ bookmark?, limit? }` | `{ results: NftCollectionAuthorization[], nextPageBookmark? }` |

#### Write Operations (signed, wallet required)

| Method | DTO fields |
|--------|-----------|
| `TransferToken` | `{ from, to, tokenInstance: { collection, category, type, additionalKey, instance }, quantity, uniqueKey }` |
| `MintToken` | `{ tokenClass: { collection, category, type, additionalKey }, owner, quantity, uniqueKey }` |
| `BurnTokens` | `{ tokenInstances: [{ tokenInstanceKey: { collection, category, type, additionalKey, instance }, quantity }], uniqueKey }` |
| `CreateTokenClass` | `{ tokenClass: { collection, category, type, additionalKey }, name, symbol, description, image, isNonFungible, decimals, uniqueKey, maxSupply?, maxCapacity?, rarity?, authorities? }` |
| `GrantNftCollectionAuthorization` | `{ collection, authorizedUser, uniqueKey }` |
| `CreateNftCollection` | `{ collection, category, type, additionalKey, name, symbol, description, image, uniqueKey, metadataAddress?, contractAddress?, rarity?, maxSupply?, maxCapacity?, authorities? }` |

### DTO Construction Rules

**CRITICAL: All DTO values must be plain strings and numbers. Never pass BigNumber instances.**

The reason: the SDK's `submit()` calls `instanceToPlain()` (from class-transformer) before signing. `instanceToPlain(BigNumber(10))` produces `{c: [10], e: 1, s: 1}` (BigNumber's internal properties), which has no `toJSON()`. The deterministic JSON serializer then produces `{"c":[10],"e":1,"s":1}` instead of `"10"`. The GalaChain server normalizes this back to `"10"` for hash verification, causing a hash mismatch and wrong signer recovery.

```typescript
// WRONG - BigNumber instance will break signing
quantity: new BigNumber(amount),

// CORRECT - string value serializes consistently
quantity: new BigNumber(amount).toString(),

// ALSO CORRECT - plain string
quantity: amount.toString(),
```

Every write DTO needs a `uniqueKey` field (random base64 string) to prevent replay attacks.

### Wallet Connection & Signing

Wallet state lives in `client/src/stores/wallet.ts` (Pinia store). The `BrowserConnectClient` instance is created on `connect()` and accessed via `getClient()`.

#### Sign Override (IMPORTANT)

`BrowserConnectClient` v2.7.1 has two bugs in its `sign()` method that we work around with an override in `wallet.ts`:

1. **Wrong prefix length**: `calculatePersonalSignPrefix()` converges on `prefix.length + data.length` instead of just `data.length`. See [eth.spec.ts#L376](https://github.com/GalaChain/sdk/blob/main/chain-api/src/utils/signatures/eth.spec.ts#L376) for the correct behavior.

2. **EIP-712 instead of personal_sign**: The default `SigningType.SIGN_TYPED_DATA` adds `domain` and `types` fields to the signed DTO, which triggers EIP-712 verification on the server. GalaChain gateway expects personal_sign (EIP-191).

The override in `wallet.ts` replaces `client.sign()` to:
- Use `signatures.getPayloadToSign(payload)` from `@gala-chain/api` (strips `signature`, `prefix`, `multisig`, `trace` fields, then returns `serialize(plain)`)
- Compute the correct prefix: `\x19Ethereum Signed Message:\n{data.length}`
- Call `client.signMessage(data)` which triggers MetaMask's `personal_sign`
- Return `{ ...payload, prefix, signature }` without `domain`/`types`

```typescript
;(client as any).sign = async (_method: string, payload: Record<string, unknown>) => {
  const data = signatures.getPayloadToSign(payload as object)
  const prefix = `\u0019Ethereum Signed Message:\n${data.length}`
  const signature = await client!.signMessage(data)
  return { ...payload, prefix, signature }
}
```

**Do not remove this override.** Without it, all signed operations will fail with `MISSING_SIGNER` or recover the wrong address.

#### Signing Flow (how it works end-to-end)

This is the pattern used for all write operations in `galachainClient.ts`:

```typescript
// 1. Build a plain DTO with string values (no BigNumber instances)
const dto = {
  from: 'eth|abc123...',
  to: 'eth|def456...',
  quantity: '10',  // string, not BigNumber
  uniqueKey: generateUniqueKey(),
}

// 2. Sign with the overridden client.sign() - triggers MetaMask popup
const signedDto = await client.sign('TransferToken', dto)
// signedDto = { ...dto, prefix: '\x19Ethereum Signed Message:\n214', signature: '0x...' }

// 3. POST the signed DTO directly to the gateway
const response = await fetch(`${gatewayUrl}/TransferToken`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(signedDto),
})
```

This deliberately **bypasses the SDK's `submit()` and `TokenApi`** methods. We do NOT use `TokenApi.TransferToken()` or `client.submit()` because `submit()` calls `instanceToPlain()` before signing, which breaks BigNumber serialization. Instead, `galachainClient.ts` provides `signAndPost()` which calls `client.sign()` then `fetch()`.

#### Signature Format

MetaMask produces compact 65-byte Ethereum signatures (r + s + v) as 132-character hex strings (`0x` + 130 hex chars). The recovery parameter `v` is `0x1b` (27) or `0x1c` (28) — both are valid and mathematically determined. GalaChain does NOT use DER signatures for browser signing. DER is only used for server-side node.js signing with elliptic keys.

### Key Files for GalaChain Integration

| File | Purpose |
|------|---------|
| `client/src/lib/galachainClient.ts` | All GalaChain API calls. `post()` for reads, `signAndPost()` for writes. |
| `client/src/lib/galachainErrors.ts` | `GalaChainError` class, error code mapping, response parsing. |
| `client/src/stores/wallet.ts` | MetaMask connection, `BrowserConnectClient` lifecycle, **sign override**. |
| `client/src/stores/network.ts` | Mainnet/testnet toggle, gateway URL. |

### SDK Pitfalls to Avoid

1. **Never use `TokenApi` methods or `client.submit()` for write operations.** They call `instanceToPlain()` before signing, which breaks BigNumber serialization. Use `client.sign()` + `fetch()` instead.

2. **Never pass BigNumber instances in DTOs.** Always convert to strings first. This applies to `quantity`, `instance`, `maxSupply`, `maxCapacity`, and any other numeric DTO field.

3. **Never remove the sign override in `wallet.ts`.** The SDK's built-in `sign()` in v2.7.1 has broken prefix calculation and defaults to EIP-712 instead of personal_sign.

4. **Always include `uniqueKey` in write DTOs.** Without it, transactions may be rejected as replays.

5. **The `signatures` import must come from `@gala-chain/api`**, not `@gala-chain/connect`. It provides `getPayloadToSign()` which is used in the sign override.

### Reference Implementation

See [github.com/Jehosephat/gala-faucet](https://github.com/Jehosephat/gala-faucet) for a working example of MetaMask signing with GalaChain. It uses the same pattern: `client.sign(method, dto)` + `axios.post(gateway + "/" + method, signedDto)`. Note: it uses an older SDK version (v1.4.2) with `MetamaskConnectClient` (renamed to `BrowserConnectClient` in v2.x).
