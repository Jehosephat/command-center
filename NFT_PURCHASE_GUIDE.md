# Implementing NFT Purchases on GalaChain

A guide for developers building apps where users pay with GalaChain tokens (GALA, GUSDT, etc.) to receive NFTs. For example, a game where players buy in-game items.

## How It Works

1. **Buyer** signs a token transfer (via MetaMask) sending payment to your app wallet
2. **Your backend** submits the payment to GalaChain, verifies success
3. **Your backend** mints the NFT directly to the buyer using `MintTokenWithAllowance`

Since your app wallet is the token authority (it created the NFT collection), it can mint at will — no separate allowance granting step needed.

```
Buyer (MetaMask)                          Your Backend                         GalaChain
      |                                        |                                  |
      |-- signs TransferToken DTO ------------>|                                  |
      |                                        |-- POST TransferToken ----------->|
      |                                        |<-- Status: 1 (payment confirmed) |
      |                                        |-- POST MintTokenWithAllowance -->|
      |                                        |<-- minted instance IDs ----------|
      |<-- { success, mintedInstances } -------|                                  |
```

## Prerequisites

- An NFT collection and class created on-chain by your app wallet
- `@gala-chain/api` npm package on the server
- `@gala-chain/connect` npm package on the client
- Node.js 20+

## Key Concepts

### Token Identification

Every token is identified by a 4-part key: `collection|category|type|additionalKey`

Example: `MyGame|Weapon|Sword|Legendary`

### Addresses

GalaChain uses `eth|` prefixed addresses: `eth|65862110e4Ef4933194dea8bFC07974Be9FF4F40`

### Gateway

All operations are HTTP POST to `{gatewayUrl}/{MethodName}`. Response: `{ Status: 1, Data: ... }` on success.

- Mainnet: `https://gateway-mainnet.galachain.com/api/asset/token-contract`
- Testnet: `https://galachain-gateway-chain-platform-stage-chain-platform-eks.stage.galachain.com/api/asset/token-contract`

## Setup

### Environment Variables

```env
APP_WALLET_PRIVATE_KEY=<64-char hex, no 0x prefix>
APP_WALLET_ADDRESS=eth|<checksummed address>
```

The app wallet is both the NFT creator and the payment recipient. Keep the private key on the server only.

### Browser Client — Required Sign Override

`BrowserConnectClient` v2.x has signing bugs. You must override `sign()`:

```typescript
import { BrowserConnectClient } from '@gala-chain/connect'
import { signatures } from '@gala-chain/api'

const client = new BrowserConnectClient()

;(client as any).sign = async (_method: string, payload: Record<string, unknown>) => {
  const data = signatures.getPayloadToSign(payload as object)
  const prefix = `\u0019Ethereum Signed Message:\n${data.length}`
  const signature = await client.signMessage(data)
  return { ...payload, prefix, signature }
}

await client.connect()
```

Without this, all MetaMask-signed operations fail with `MISSING_SIGNER`.

## Frontend: Buyer Signs Payment

Build a `TransferToken` DTO and have the buyer sign it with MetaMask. Send the signed DTO to your backend — not directly to GalaChain.

```typescript
async function buyItem(itemClassKey, price) {
  const transferDto = {
    from: buyerAddress,
    to: APP_WALLET_ADDRESS,
    tokenInstance: {
      collection: 'GALA',       // payment token
      category: 'Unit',
      type: 'none',
      additionalKey: 'none',
      instance: '0',
    },
    quantity: price,             // string, e.g. '10'
    uniqueKey: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  }

  const signedDto = await client.sign('TransferToken', transferDto)

  const result = await fetch('/api/buy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signedTransferDto: signedDto,
      itemClassKey,
      buyerAddress,
      gatewayUrl,  // so backend uses same network as frontend
    }),
  })

  return result.json()
}
```

**DTO rules:**
- All numeric values must be plain strings (`'10'`), never BigNumber instances
- Every write DTO needs a random `uniqueKey` (prevents replay attacks)

## Backend: Verify Payment and Mint

### Server-Side Signing

Use the SDK's `createValidSubmitDTO().signed(privateKey)` — it handles validation, uniqueKey, and signerPublicKey automatically:

```typescript
import { createValidSubmitDTO, MintTokenWithAllowanceDto } from '@gala-chain/api'
import BigNumber from 'bignumber.js'

const APP_WALLET_PRIVATE_KEY = process.env.APP_WALLET_PRIVATE_KEY

async function mintToOwner(tokenClass, owner, quantity, gatewayUrl) {
  const signedDto = await createValidSubmitDTO(MintTokenWithAllowanceDto, {
    tokenClass,
    tokenInstance: new BigNumber(0),
    owner,
    quantity: new BigNumber(quantity),
  }).signed(APP_WALLET_PRIVATE_KEY)

  return submitToGateway('MintTokenWithAllowance', signedDto, gatewayUrl)
}

async function submitToGateway(method, signedDto, gatewayUrl) {
  const response = await fetch(`${gatewayUrl}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signedDto),
  })
  const result = await response.json()
  if (result.Status !== 1) {
    throw new Error(result.Message || 'GalaChain error')
  }
  return result.Data
}
```

**`MintTokenWithAllowance` vs `MintToken`:** Since the app wallet is the token authority (it created the collection), use `MintTokenWithAllowance` — it grants an allowance to itself and mints in one atomic operation. No separate `GrantAllowance` step needed.

### Purchase Endpoint

```typescript
app.post('/api/buy', async (req, res) => {
  const { signedTransferDto, itemClassKey, buyerAddress, gatewayUrl } = req.body

  // 1. Validate the payment DTO
  if (signedTransferDto.to !== APP_WALLET_ADDRESS) {
    return res.status(400).json({ error: 'Wrong payment recipient' })
  }
  // Also validate amount matches expected price for this item

  // 2. Submit buyer's payment to GalaChain
  await submitToGateway('TransferToken', signedTransferDto, gatewayUrl)

  // 3. Mint NFT to buyer (app wallet is the authority, so this just works)
  const minted = await mintToOwner(itemClassKey, buyerAddress, '1', gatewayUrl)

  res.json({ success: true, mintedInstances: minted })
})
```

## Failure Handling

If payment succeeds but minting fails, the buyer paid but didn't get the NFT. Track purchase status in a database:

```
pending → payment_verified → minted
                           → failed (retry the mint later)
```

Store the signed transfer DTO and purchase details so you can retry the mint without re-charging the buyer.

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| BigNumber instances in browser DTOs | Always use `.toString()` — the SDK's serialization breaks BigNumber objects |
| `maxSupply: Infinity` when creating classes | Omit the field entirely for unlimited supply |
| Sign override missing | Required for `@gala-chain/connect` v2.x — without it, all signatures fail |
| Backend on wrong network | Pass `gatewayUrl` from frontend with each request |
| `eth|abc123` rejected | Addresses must be properly checksummed: `eth|4e0CD6A94a839F3D9a6F21013A4B0b8E1C8A51ee` |

## Reading Chain Data

Unsigned reads (no wallet needed):

```typescript
// Fetch NFT classes in a collection
POST {gatewayUrl}/FetchTokenClassesWithPagination
Body: { "collection": "MyGame" }

// Fetch a player's token balances
POST {gatewayUrl}/FetchBalances
Body: { "owner": "eth|..." }
```
