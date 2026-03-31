import { ref } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { grantAllowance } from '@/lib/galachainClient'
import * as api from '@/lib/marketplaceApi'
import type { CreateListingInput, MarketplaceListing } from '@shared/types/marketplace'

export function useCreateListing() {
  const walletStore = useWalletStore()
  const isGranting = ref(false)
  const isCreating = ref(false)
  const error = ref<string | null>(null)

  function clearError() {
    error.value = null
  }

  /**
   * Step 1: Grant mint allowance to the fulfiller wallet
   */
  async function grantMintAllowance(
    tokenClass: { collection: string; category: string; type: string; additionalKey: string },
    fulfillerAddress: string,
    quantity: string,
  ): Promise<boolean> {
    if (!walletStore.connected) {
      error.value = 'Wallet not connected'
      return false
    }

    isGranting.value = true
    error.value = null

    try {
      const client = walletStore.getClient()
      if (!client) {
        error.value = 'Unable to get wallet client'
        return false
      }

      await grantAllowance(client, {
        tokenInstance: { ...tokenClass, instance: '0' },
        grantedTo: fulfillerAddress,
        quantity,
        allowanceType: 4, // AllowanceType.Mint
        uses: quantity, // allow as many mint operations as the supply
      })

      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to grant allowance'
      return false
    } finally {
      isGranting.value = false
    }
  }

  /**
   * Step 2: Create the listing in the backend
   */
  async function createListing(input: CreateListingInput): Promise<MarketplaceListing | null> {
    isCreating.value = true
    error.value = null

    try {
      const listing = await api.createListing(input)
      return listing
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create listing'
      return null
    } finally {
      isCreating.value = false
    }
  }

  return {
    isGranting,
    isCreating,
    error,
    clearError,
    grantMintAllowance,
    createListing,
  }
}
