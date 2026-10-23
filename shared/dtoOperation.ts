/**
 * Build the `dtoOperation` value that every signed GalaChain DTO must carry.
 *
 * Format: `{channelId}_{chaincodeId}_{Contract}:{Method}`
 *   e.g. `asset-channel_basic-asset_GalaChainToken:TransferToken`
 *
 * The chaincode rejects a signed DTO when this field is missing or does not
 * match the method being executed, so it must be set BEFORE signing so the
 * signature covers it. Unsigned (read) DTOs may omit it.
 *
 * The gateway URL shape is `{host}/api/{channel}/{contract}`, so the
 * operation is derived from the same URL the DTO is posted to.
 */

/** Gateway contract path segment -> Fabric contract name. */
const CONTRACT_NAMES: Record<string, string> = {
  'token-contract': 'GalaChainToken',
  'public-key-contract': 'PublicKeyContract',
}

/**
 * Gateway channel path segment -> Fabric channel/chaincode IDs, from the
 * gateway's channel config. Only asset and spidertanks differ from their path;
 * every other channel uses its path as both channel and chaincode name.
 */
const SAME_NAME_CHANNELS = [
  'championsarena',
  'echoesofempire',
  'eternalparadox',
  'galafilm',
  'lastexpedition',
  'legacy',
  'legendsreborn',
  'mirandus',
  'music',
  'node',
  'pokergo',
  'superior',
  'thewalkingdeadempires',
  'townstar',
  'vox',
]

const CHANNEL_IDS: Record<string, { channelId: string; chaincodeId: string }> = {
  asset: { channelId: 'asset-channel', chaincodeId: 'basic-asset' },
  spidertanks: { channelId: 'spidertanks-channel', chaincodeId: 'spidertanks' },
  ...Object.fromEntries(SAME_NAME_CHANNELS.map(c => [c, { channelId: c, chaincodeId: c }])),
}

export function dtoOperationFor(gatewayUrl: string, method: string): string {
  const match = new URL(gatewayUrl).pathname.match(/\/api\/([^/]+)\/([^/]+)\/?$/)
  if (!match) {
    throw new Error(`Cannot derive dtoOperation from gateway URL: ${gatewayUrl}`)
  }
  const [, channel, contractPath] = match

  const contractName = CONTRACT_NAMES[contractPath]
  if (!contractName) {
    throw new Error(`Unknown GalaChain contract path "${contractPath}" in ${gatewayUrl}`)
  }

  const ids = CHANNEL_IDS[channel]
  if (!ids) {
    throw new Error(`Unknown GalaChain channel "${channel}" in ${gatewayUrl}`)
  }
  const { channelId, chaincodeId } = ids

  return `${channelId}_${chaincodeId}_${contractName}:${method}`
}
