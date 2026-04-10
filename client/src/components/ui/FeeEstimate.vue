<script setup lang="ts">
/**
 * FeeEstimate.vue
 * Displays an estimated GalaChain fee for a write operation via DryRun.
 *
 * Usage:
 *   <FeeEstimate method="TransferToken" :dto="transferDto" />
 *
 * The component debounces DryRun calls (default 400ms) and dedupes by the
 * JSON-serialized DTO, so identical successive updates don't re-fire the request.
 * Pass only fee-relevant fields in `dto` — cosmetic fields like description/image
 * don't affect the fee and shouldn't be included.
 */
import { watch, onMounted, onUnmounted, computed, ref } from 'vue'
import { useEstimateFee } from '@/composables/useEstimateFee'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const props = withDefaults(
  defineProps<{
    method: string
    dto: object | null
    /** Token symbol to show next to the fee (defaults to GALA). */
    symbol?: string
    /** Debounce delay in milliseconds before firing the DryRun (default 400). */
    debounceMs?: number
  }>(),
  { debounceMs: 400 },
)

const {
  estimatedFee,
  isEstimating,
  error,
  simulationSucceeded,
  simulationError,
  simulationErrorKey,
  estimate,
  clear,
} = useEstimateFee()

// Track the last DTO we actually submitted so we can dedupe identical updates
let lastSubmittedKey: string | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const pending = ref(false)

function cancelPending() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  pending.value = false
}

async function runEstimate() {
  pending.value = false
  if (!props.dto) {
    clear()
    lastSubmittedKey = null
    return
  }
  const key = `${props.method}|${JSON.stringify(props.dto)}`
  if (key === lastSubmittedKey) return
  lastSubmittedKey = key
  await estimate(props.method, props.dto)
}

function scheduleEstimate() {
  cancelPending()
  if (!props.dto) {
    clear()
    lastSubmittedKey = null
    return
  }
  // Skip scheduling if nothing fee-relevant changed
  const key = `${props.method}|${JSON.stringify(props.dto)}`
  if (key === lastSubmittedKey) return
  pending.value = true
  debounceTimer = setTimeout(runEstimate, props.debounceMs)
}

// Human-readable warning for simulation failures
const simulationWarning = computed(() => {
  if (simulationSucceeded.value) return null
  if (simulationErrorKey.value === 'PAYMENT_REQUIRED') return 'Insufficient balance to pay fee'
  if (simulationError.value) {
    return simulationError.value.length > 100
      ? simulationError.value.slice(0, 97) + '...'
      : simulationError.value
  }
  return 'Simulated operation would fail'
})

// Show a subtle "estimating" state when either we're actively fetching OR debouncing
const showEstimating = computed(() => isEstimating.value || pending.value)

onMounted(scheduleEstimate)
onUnmounted(cancelPending)
watch(() => [props.method, props.dto], scheduleEstimate, { deep: true })
</script>

<template>
  <div class="text-sm">
    <div class="flex items-center justify-between py-2">
      <span class="text-gray-500 dark:text-gray-400">Estimated Fee</span>
      <span v-if="showEstimating" class="flex items-center gap-1.5 text-gray-500">
        <LoadingSpinner size="sm" />
        <span>Estimating...</span>
      </span>
      <span v-else-if="error" class="text-xs text-amber-600" :title="error">
        Unable to estimate
      </span>
      <span
        v-else-if="estimatedFee !== null"
        class="font-medium"
        :class="simulationSucceeded ? 'text-gray-900 dark:text-white' : 'text-amber-600'"
      >
        {{ estimatedFee === '0' ? 'None' : `${estimatedFee} ${symbol || 'GALA'}` }}
      </span>
      <span v-else class="text-gray-400">—</span>
    </div>
    <p
      v-if="!showEstimating && !error && simulationWarning"
      class="text-xs text-amber-600 flex items-start gap-1 pt-0.5"
    >
      <svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ simulationWarning }}</span>
    </p>
  </div>
</template>
