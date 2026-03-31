<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { EnrichedListing } from '@shared/types/marketplace'
import { usePurchase } from '@/composables/usePurchase'
import { useWallet } from '@/composables/useWallet'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const props = defineProps<{
  open: boolean
  listing: EnrichedListing | null
  fulfillerAddress: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const { connected } = useWallet()
const { isSigning, isPurchasing, error, clearError, calculateBreakdown, executePurchase } = usePurchase()

const dialogRef = ref<HTMLDialogElement | null>(null)
const quantity = ref(1)

const breakdown = computed(() => {
  if (!props.listing) return null
  return calculateBreakdown(props.listing, quantity.value)
})

const paymentTokenSymbol = computed(() => props.listing?.priceTokenCollection || 'GALA')

const maxQuantity = computed(() => {
  if (!props.listing) return 1
  if (props.listing.totalSupply === null) return 100
  return Math.max(0, props.listing.totalSupply - props.listing.totalSold)
})

const isProcessing = computed(() => isSigning.value || isPurchasing.value)

watch(() => props.open, (isOpen) => {
  nextTick(() => {
    if (isOpen && dialogRef.value) {
      dialogRef.value.showModal()
      quantity.value = 1
      clearError()
    } else if (!isOpen && dialogRef.value) {
      dialogRef.value.close()
    }
  })
})

function handleClose() {
  clearError()
  emit('close')
}

function handleDialogClick(e: MouseEvent) {
  if (e.target === dialogRef.value) handleClose()
}

async function handlePurchase() {
  if (!props.listing) return
  const result = await executePurchase(props.listing, quantity.value, props.fulfillerAddress)
  if (result) {
    emit('success')
    handleClose()
  }
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="fixed inset-0 m-0 w-full h-full max-w-none max-h-none bg-white rounded-none shadow-2xl backdrop:bg-black/50 p-0 open:flex open:flex-col sm:inset-auto sm:m-auto sm:w-full sm:max-w-md sm:h-auto sm:max-h-[90vh] sm:rounded-xl"
    @close="handleClose"
    @click="handleDialogClick"
  >
    <div class="flex flex-col h-full sm:max-h-[90vh]" @click.stop>
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Purchase NFT</h2>
        <button
          type="button"
          class="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          :disabled="isProcessing"
          @click="handleClose"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="listing" class="flex-1 overflow-y-auto px-6 py-4">
        <!-- Error -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-700">{{ error }}</p>
        </div>

        <!-- Listing info -->
        <div class="flex items-center gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
          <div
            v-if="listing.image"
            class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
          >
            <img :src="listing.image" :alt="listing.name" class="w-full h-full object-cover" />
          </div>
          <div>
            <h3 class="font-semibold text-gray-900">{{ listing.name }}</h3>
            <p class="text-sm text-gray-500">{{ listing.collection }}</p>
          </div>
        </div>

        <!-- Quantity -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              :disabled="quantity <= 1"
              @click="quantity--"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
              </svg>
            </button>
            <input
              v-model.number="quantity"
              type="number"
              min="1"
              :max="maxQuantity"
              class="input flex-1 text-center"
            />
            <button
              type="button"
              class="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              :disabled="quantity >= maxQuantity"
              @click="quantity++"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Price breakdown -->
        <div v-if="breakdown" class="mb-6 space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">Price per NFT</span>
            <span class="font-medium">{{ breakdown.pricePerUnit }} {{ paymentTokenSymbol }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500">Quantity</span>
            <span class="font-medium">x{{ quantity }}</span>
          </div>
          <div class="flex justify-between pt-2 border-t border-gray-200">
            <span class="text-gray-500">Platform fee ({{ listing.platformFeePercent }}%)</span>
            <span class="font-medium">{{ breakdown.platformFee }} {{ paymentTokenSymbol }}</span>
          </div>
          <div class="flex justify-between text-base font-bold">
            <span>Total</span>
            <span class="text-purple-600">{{ breakdown.totalCost }} {{ paymentTokenSymbol }}</span>
          </div>
        </div>

        <!-- Status message -->
        <div v-if="isSigning" class="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <p class="text-sm text-blue-700">Please confirm the transaction in your wallet...</p>
        </div>
        <div v-if="isPurchasing" class="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
          <p class="text-sm text-green-700">Processing purchase and minting your NFT...</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 flex gap-3">
        <button
          type="button"
          class="flex-1 btn-secondary"
          :disabled="isProcessing"
          @click="handleClose"
        >
          Cancel
        </button>
        <button
          type="button"
          class="flex-1 btn-primary flex items-center justify-center gap-2"
          :disabled="isProcessing || !connected || quantity < 1"
          @click="handlePurchase"
        >
          <LoadingSpinner v-if="isProcessing" size="sm" />
          <span>{{ isSigning ? 'Signing...' : isPurchasing ? 'Minting...' : 'Buy Now' }}</span>
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
dialog::backdrop { background-color: rgba(0, 0, 0, 0.5); }
dialog { border: none; }
dialog:not([open]) { display: none; }
</style>
