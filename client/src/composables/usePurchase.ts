import { ref } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { useNetworkStore } from '@/stores/network'
import * as api from '@/lib/marketplaceApi'
import type { MarketplaceListing, MarketplacePurchase, EnrichedListing } from '@shared/types/marketplace'
import BigNumber from 'bignumber.js'

export function usePurchase() {
  const walletStore = useWalletStore()
  const networkStore = useNetworkStore()
  const isSigning = ref(false)
  const isPurchasing = ref(false)
  const error = ref<string | null>(null)

  function clearError() {
    error.value = null
  }

  /**
   * Calculate price breakdown for a purchase
   */
  function calculateBreakdown(listing: MarketplaceListing | EnrichedListing, quantity: number) {
    const price = new BigNumber(listing.priceAmount)
    const total = price.times(quantity)
    const fee = total.times(listing.platformFeePercent).div(100)
    const sellerReceives = total.minus(fee)

    return {
      pricePerUnit: price.toString(),
      totalCost: total.toString(),
      platformFee: fee.toString(),
      sellerReceives: sellerReceives.toString(),
    }
  }

  /**
   * Execute a purchase: sign the transfer DTO, then send to backend
   */
  async function executePurchase(
    listing: MarketplaceListing | EnrichedListing,
    quantity: number,
    fulfillerAddress: string,
  ): Promise<MarketplacePurchase | null> {
    if (!walletStore.connected || !walletStore.address) {
      error.value = 'Wallet not connected'
      return null
    }

    const client = walletStore.getClient()
    if (!client) {
      error.value = 'Unable to get wallet client'
      return null
    }

    error.value = null
    isSigning.value = true

    try {
      // Build the transfer DTO that the buyer will sign
      const { totalCost } = calculateBreakdown(listing, quantity)

      const transferDto = {
        from: walletStore.address,
        to: fulfillerAddress,
        tokenInstance: {
          collection: listing.priceTokenCollection,
          category: listing.priceTokenCategory,
          type: listing.priceTokenType,
          additionalKey: listing.priceTokenAdditionalKey,
          instance: '0',
        },
        quantity: totalCost,
        uniqueKey: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
      }

      // Sign the transfer with MetaMask
      const signedDto = await client.sign('TransferToken', transferDto)
      isSigning.value = false
      isPurchasing.value = true

      // Submit to the backend
      const purchase = await api.executePurchase({
        listingId: listing.id,
        quantity,
        buyerAddress: walletStore.address,
        signedTransferDto: signedDto,
        gatewayUrl: networkStore.gatewayUrl,
      })

      return purchase
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Purchase failed'
      return null
    } finally {
      isSigning.value = false
      isPurchasing.value = false
    }
  }

  return {
    isSigning,
    isPurchasing,
    error,
    clearError,
    calculateBreakdown,
    executePurchase,
  }
}
