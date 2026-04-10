/**
 * Composable for estimating GalaChain operation fees via DryRun.
 *
 * Usage:
 *   const { estimatedFee, isEstimating, estimate, clear } = useEstimateFee()
 *   await estimate('TransferToken', transferDto)
 *   // estimatedFee.value is now populated
 */

import { ref } from 'vue'
import { useWalletStore } from '@/stores/wallet'
import { estimateFee as estimateFeeApi } from '@/lib/galachainClient'

export function useEstimateFee() {
  const walletStore = useWalletStore()

  const estimatedFee = ref<string | null>(null)
  const isEstimating = ref(false)
  /** Error from the estimate API call itself (network, etc.) */
  const error = ref<string | null>(null)
  /** Whether the simulated operation would have succeeded (false = e.g. insufficient balance) */
  const simulationSucceeded = ref(true)
  /** Chain-side error message when simulationSucceeded is false */
  const simulationError = ref<string | null>(null)
  /** Chain-side error key (e.g. "PAYMENT_REQUIRED") */
  const simulationErrorKey = ref<string | null>(null)
  const receipts = ref<Array<{ feeCode?: string; quantity: string }>>([])

  function clear() {
    estimatedFee.value = null
    error.value = null
    simulationSucceeded.value = true
    simulationError.value = null
    simulationErrorKey.value = null
    receipts.value = []
  }

  /**
   * Estimate the fee for a write operation by simulating it via DryRun.
   * The dto should be the unsigned inner DTO (signature will be stripped if present).
   *
   * Returns the fee even when the simulation fails (e.g. insufficient balance) —
   * check simulationSucceeded to know whether the operation would actually go through.
   */
  async function estimate(method: string, dto: object): Promise<string | null> {
    if (!walletStore.address) {
      error.value = 'Wallet not connected'
      return null
    }

    isEstimating.value = true
    error.value = null

    try {
      const result = await estimateFeeApi(method, walletStore.address, dto)
      estimatedFee.value = result.totalFee
      receipts.value = result.receipts
      simulationSucceeded.value = result.simulationSucceeded
      simulationError.value = result.errorMessage ?? null
      simulationErrorKey.value = result.errorKey ?? null
      return result.totalFee
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to estimate fee'
      estimatedFee.value = null
      simulationSucceeded.value = true
      simulationError.value = null
      simulationErrorKey.value = null
      return null
    } finally {
      isEstimating.value = false
    }
  }

  return {
    estimatedFee,
    isEstimating,
    error,
    simulationSucceeded,
    simulationError,
    simulationErrorKey,
    receipts,
    estimate,
    clear,
  }
}
