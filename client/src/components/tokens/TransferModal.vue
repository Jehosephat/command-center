<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import type { FungibleTokenDisplay } from '@shared/types/display'
import { createTransferSchema, formatAmount } from '@/lib/schemas/transferSchema'
import { useTransferToken } from '@/composables/useTransferToken'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import FeeEstimate from '@/components/ui/FeeEstimate.vue'
import BigNumber from 'bignumber.js'

interface Props {
  token: FungibleTokenDisplay | null
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: [token: FungibleTokenDisplay]
}>()

// Transfer composable
const { executeTransfer, isTransferring, error: transferError, fromAddress, clearError } = useTransferToken()

// Dialog ref
const dialogRef = ref<HTMLDialogElement | null>(null)

// Local state
const showConfirmation = ref(false)
const localError = ref<string | null>(null)

// Computed: spendable balance for the token
const spendableBalance = computed(() => {
  if (!props.token) return '0'
  return props.token.spendableBalanceRaw || props.token.balanceRaw
})

// Computed: validation schema with current balance
const validationSchema = computed(() => {
  return toTypedSchema(createTransferSchema(spendableBalance.value, fromAddress.value))
})

// Form setup with VeeValidate
const { handleSubmit, resetForm, meta } = useForm({
  validationSchema,
})

// Fields
const { value: recipientAddress, errorMessage: recipientError } = useField<string>('recipientAddress')
const { value: amount, errorMessage: amountError } = useField<string>('amount')

// Initialize field values
recipientAddress.value = ''
amount.value = ''

// Computed: form can submit
const canSubmit = computed(() => {
  return meta.value.valid && !isTransferring.value && recipientAddress.value && amount.value
})

// Computed: inner DTO used for fee estimation via DryRun
const transferDtoForEstimate = computed(() => {
  if (!props.token || !recipientAddress.value || !amount.value || !fromAddress.value) return null
  return {
    from: fromAddress.value,
    to: recipientAddress.value,
    tokenInstance: {
      collection: props.token.collection,
      category: props.token.category,
      type: props.token.type,
      additionalKey: props.token.additionalKey,
      instance: '0',
    },
    quantity: new BigNumber(amount.value).toString(),
  }
})

// Computed: combined error
const displayError = computed(() => localError.value || transferError.value)

// Watch for open state changes
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    showDialog()
  } else {
    hideDialog()
  }
})

// Watch for token changes to reset form
watch(() => props.token, () => {
  resetFormState()
})

function showDialog() {
  if (dialogRef.value) {
    dialogRef.value.showModal()
    resetFormState()
  }
}

function hideDialog() {
  if (dialogRef.value) {
    dialogRef.value.close()
  }
}

function resetFormState() {
  resetForm()
  recipientAddress.value = ''
  amount.value = ''
  showConfirmation.value = false
  localError.value = null
  clearError()
}

function handleClose() {
  resetFormState()
  emit('close')
}

// Handle clicks on dialog backdrop
function handleDialogClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target === dialogRef.value) {
    handleClose()
  }
}

// Handle ESC key
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose()
  }
}

// Set max amount
function setMaxAmount() {
  amount.value = spendableBalance.value
}

// Go to confirmation step
const goToConfirmation = handleSubmit(() => {
  showConfirmation.value = true
  localError.value = null
})

// Go back to form
function goBackToForm() {
  showConfirmation.value = false
}

// Execute the transfer
async function confirmTransfer() {
  if (!props.token) return

  localError.value = null

  const result = await executeTransfer(
    props.token,
    recipientAddress.value,
    amount.value
  )

  if (result.success) {
    emit('success', props.token)
    handleClose()
  } else {
    // Show error in confirmation view
    localError.value = result.error || 'Transfer failed'
  }
}

// Format amount for display
function formatDisplayAmount(amt: string): string {
  return formatAmount(amt, props.token?.decimals || 8)
}

// Truncate address for display
function truncateAddress(address: string): string {
  if (!address) return ''
  if (address.length <= 20) return address
  return `${address.slice(0, 12)}...${address.slice(-8)}`
}

onMounted(() => {
  if (props.open) {
    showDialog()
  }
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <dialog
    ref="dialogRef"
    class="fixed inset-0 m-0 w-full h-full max-w-none max-h-none bg-white dark:bg-gray-900 rounded-none shadow-2xl backdrop:bg-black/50 p-0 open:flex open:flex-col sm:inset-auto sm:m-auto sm:w-full sm:max-w-md sm:h-auto sm:max-h-[90vh] sm:rounded-xl"
    @click="handleDialogClick"
  >
    <div v-if="token" class="flex flex-col h-full sm:max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ showConfirmation ? 'Confirm Transfer' : 'Transfer' }} {{ token.symbol }}
        </h2>
        <button
          type="button"
          class="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :disabled="isTransferring"
          @click="handleClose"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- Error Display -->
        <div
          v-if="displayError"
          class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <div class="flex items-start gap-2">
            <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p class="text-sm text-red-700 dark:text-red-300">{{ displayError }}</p>
          </div>
        </div>

        <!-- Form View -->
        <div v-if="!showConfirmation">
          <!-- Token Info -->
          <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                :class="token.image ? 'bg-transparent' : 'bg-gradient-to-br from-gala-primary to-gala-secondary'"
              >
                <img
                  v-if="token.image"
                  :src="token.image"
                  :alt="token.name"
                  class="w-10 h-10 rounded-full object-cover"
                />
                <span v-else>{{ token.symbol.slice(0, 2).toUpperCase() }}</span>
              </div>
              <div>
                <p class="font-medium text-gray-900 dark:text-white">{{ token.name }}</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Balance: {{ token.spendableBalanceFormatted }} {{ token.symbol }}
                </p>
              </div>
            </div>
          </div>

          <!-- Transfer Form -->
          <form @submit.prevent="goToConfirmation">
            <!-- Recipient Address -->
            <div class="mb-4">
              <label
                for="recipientAddress"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Recipient Address
              </label>
              <input
                id="recipientAddress"
                v-model="recipientAddress"
                type="text"
                placeholder="client|abc123... or 0x..."
                class="input w-full"
                :class="{ 'border-red-500 dark:border-red-500': recipientError }"
                :disabled="isTransferring"
              />
              <p v-if="recipientError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                {{ recipientError }}
              </p>
            </div>

            <!-- Amount -->
            <div class="mb-6">
              <label
                for="amount"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Amount
              </label>
              <div class="relative">
                <input
                  id="amount"
                  v-model="amount"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                  class="input w-full pr-20"
                  :class="{ 'border-red-500 dark:border-red-500': amountError }"
                  :disabled="isTransferring"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-medium text-gala-primary hover:text-gala-primary/80 transition-colors"
                  :disabled="isTransferring"
                  @click="setMaxAmount"
                >
                  MAX
                </button>
              </div>
              <p v-if="amountError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                {{ amountError }}
              </p>
              <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Available: {{ token.spendableBalanceFormatted }} {{ token.symbol }}
              </p>
            </div>
          </form>
        </div>

        <!-- Confirmation View -->
        <div v-else>
          <div class="space-y-4">
            <!-- Transfer Summary -->
            <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Token</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ token.name }} ({{ token.symbol }})
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Amount</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatDisplayAmount(amount) }} {{ token.symbol }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">To</span>
                <span
                  class="text-sm font-mono text-gray-900 dark:text-white"
                  :title="recipientAddress"
                >
                  {{ truncateAddress(recipientAddress) }}
                </span>
              </div>
              <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                <FeeEstimate method="TransferToken" :dto="transferDtoForEstimate" />
              </div>
            </div>

            <!-- Warning -->
            <div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p class="text-sm text-yellow-700 dark:text-yellow-300">
                  Please verify the recipient address carefully. Token transfers cannot be reversed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <template v-if="!showConfirmation">
          <button
            type="button"
            class="flex-1 btn-secondary"
            :disabled="isTransferring"
            @click="handleClose"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 btn-primary"
            :disabled="!canSubmit"
            @click="goToConfirmation"
          >
            Continue
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="flex-1 btn-secondary"
            :disabled="isTransferring"
            @click="goBackToForm"
          >
            Back
          </button>
          <button
            type="button"
            class="flex-1 btn-primary flex items-center justify-center gap-2"
            :disabled="isTransferring"
            @click="confirmTransfer"
          >
            <LoadingSpinner v-if="isTransferring" size="sm" />
            <span>{{ isTransferring ? 'Transferring...' : 'Confirm Transfer' }}</span>
          </button>
        </template>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}

dialog {
  border: none;
}

dialog:not([open]) {
  display: none;
}
</style>
