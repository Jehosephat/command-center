<script setup lang="ts">
/**
 * CollectionMintModal.vue
 * Modal for minting NFTs from a creator's collection.
 * Supports minting from collection level or specific class level.
 */
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import type { CreatorCollectionDisplay, CreatorClassDisplay } from '@/stores/creatorCollections'
import { useCollectionMint } from '@/composables/useCollectionMint'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import FeeEstimate from '@/components/ui/FeeEstimate.vue'
import BigNumber from 'bignumber.js'

interface Props {
  open: boolean
  collection: CreatorCollectionDisplay | null
  /** Optional: pre-select a specific class to mint from */
  selectedClass?: CreatorClassDisplay | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: [collection: CreatorCollectionDisplay, quantity: number, classItem?: CreatorClassDisplay]
}>()

// Composables
const {
  executeMintFromCollection,
  executeMintFromClass,
  isMinting,
  error: mintError,
  ownerAddress,
  clearError,
  getMaxMintableQuantity,
  getMaxMintableQuantityForClass,
} = useCollectionMint()

// Dialog ref
const dialogRef = ref<HTMLDialogElement | null>(null)

// Local state
const showConfirmation = ref(false)
const localError = ref<string | null>(null)
const selectedClassKey = ref<string | null>(null)

// Computed: selected class (if any)
const selectedClass = computed((): CreatorClassDisplay | null => {
  if (!selectedClassKey.value || !props.collection) return null
  return props.collection.classes.find(c => c.classKey === selectedClassKey.value) || null
})

// Computed: whether to show class selector
const hasClasses = computed(() => {
  return props.collection?.classes && props.collection.classes.length > 0
})

// Computed: formatted mint allowance for display
const mintAllowanceFormatted = computed(() => {
  if (!props.collection) return '0'
  return props.collection.mintAllowanceFormatted || '0'
})

// Computed: max quantity user can mint (considers both allowance and supply if class selected)
const maxMintQuantity = computed(() => {
  if (!props.collection) return 0

  if (selectedClass.value) {
    // When class is selected, also consider class supply limit
    const classMax = getMaxMintableQuantityForClass(selectedClass.value)
    const collectionMax = getMaxMintableQuantity(props.collection)
    return Math.min(classMax, collectionMax)
  }

  return getMaxMintableQuantity(props.collection)
})

// Computed: remaining supply for selected class
const classSupplyRemaining = computed(() => {
  if (!selectedClass.value) return null
  const maxSupply = new BigNumber(selectedClass.value.maxSupply || '0')
  if (maxSupply.isZero()) return null // Unlimited
  const minted = new BigNumber(selectedClass.value.mintedCount || '0')
  return maxSupply.minus(minted).toString()
})

// Create validation schema for minting
function createMintSchema(maxQuantity: number) {
  return z.object({
    quantity: z
      .string()
      .min(1, 'Quantity is required')
      .refine((val) => {
        const num = new BigNumber(val)
        return !num.isNaN() && num.isFinite()
      }, 'Please enter a valid number')
      .refine((val) => {
        const num = new BigNumber(val)
        return num.isGreaterThan(0)
      }, 'Quantity must be greater than 0')
      .refine((val) => {
        const num = new BigNumber(val)
        return num.isInteger()
      }, 'Quantity must be a whole number (NFTs cannot be fractional)')
      .refine((val) => {
        const num = new BigNumber(val)
        return num.isLessThanOrEqualTo(maxQuantity)
      }, `Quantity cannot exceed ${maxQuantity}`),
  })
}

// Computed: validation schema with current max
const validationSchema = computed(() => {
  return toTypedSchema(createMintSchema(maxMintQuantity.value))
})

// Form setup with VeeValidate
const { handleSubmit, resetForm, meta } = useForm({
  validationSchema,
})

// Fields
const { value: quantity, errorMessage: quantityError } = useField<string>('quantity')

// Recipient address (not part of vee-validate schema since it's optional with a default)
const recipient = ref('')

// Initialize field values
quantity.value = '1'

// Computed: form can submit
const canSubmit = computed(() => {
  return meta.value.valid && !isMinting.value && quantity.value && props.collection && maxMintQuantity.value > 0
})

// Computed: effective recipient (user input or default to connected wallet)
const effectiveRecipient = computed(() => {
  const trimmed = recipient.value.trim()
  return trimmed || ownerAddress.value
})

// Computed: combined error
const displayError = computed(() => localError.value || mintError.value)

// Computed: inner DTO used to estimate the MintToken fee via DryRun
const mintDtoForEstimate = computed(() => {
  if (!props.collection || !quantity.value || !effectiveRecipient.value) return null
  const cls = selectedClass.value || props.collection
  return {
    tokenClass: {
      collection: cls.collection,
      category: cls.category,
      type: cls.type,
      additionalKey: cls.additionalKey,
    },
    owner: effectiveRecipient.value,
    quantity: new BigNumber(quantity.value).toString(),
  }
})

// Watch for open state changes
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    showDialog()
  } else {
    hideDialog()
  }
})

// Watch for collection changes
watch(() => props.collection, () => {
  resetFormState()
})

// Watch for class selection changes to reset quantity validation
watch(selectedClassKey, () => {
  // Re-validate quantity with new constraints
  if (quantity.value) {
    const current = parseInt(quantity.value, 10)
    if (current > maxMintQuantity.value) {
      quantity.value = maxMintQuantity.value.toString()
    }
  }
  localError.value = null
})

// Watch for pre-selected class from props
watch(() => props.selectedClass, (newClass) => {
  if (newClass) {
    selectedClassKey.value = newClass.classKey
  }
}, { immediate: true })

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
  quantity.value = '1'
  recipient.value = ''
  selectedClassKey.value = props.selectedClass?.classKey || null
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

// Set max quantity
function setMaxQuantity() {
  quantity.value = maxMintQuantity.value.toString()
}

// Increment/decrement quantity
function incrementQuantity() {
  const current = parseInt(quantity.value, 10) || 0
  const max = maxMintQuantity.value
  if (current < max) {
    quantity.value = (current + 1).toString()
  }
}

function decrementQuantity() {
  const current = parseInt(quantity.value, 10) || 0
  if (current > 1) {
    quantity.value = (current - 1).toString()
  }
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

// Execute the mint
async function confirmMint() {
  if (!props.collection) return

  localError.value = null

  let result

  if (selectedClass.value) {
    result = await executeMintFromClass(
      selectedClass.value,
      quantity.value,
      props.collection,
      effectiveRecipient.value
    )
  } else {
    result = await executeMintFromCollection(
      props.collection,
      quantity.value,
      effectiveRecipient.value
    )
  }

  if (result.success) {
    emit('success', props.collection, parseInt(quantity.value, 10), selectedClass.value || undefined)
    handleClose()
  } else {
    // Show error in confirmation view
    localError.value = result.error || 'Mint failed'
  }
}

// Truncate address for display
function truncateAddress(address: string): string {
  if (!address) return ''
  if (address.length <= 20) return address
  return `${address.slice(0, 12)}...${address.slice(-8)}`
}

// Get initials for placeholder
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase() || '??'
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
    <div class="flex flex-col h-full sm:max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ showConfirmation ? 'Confirm Mint' : 'Mint from Collection' }}
        </h2>
        <button
          type="button"
          class="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :disabled="isMinting"
          @click="handleClose"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-6 py-4">
        <!-- No Collection State -->
        <div v-if="!collection" class="text-center py-8">
          <svg
            class="w-12 h-12 mx-auto text-gray-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Collection Selected
          </h3>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Please select a collection to mint from.
          </p>
        </div>

        <template v-else>
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
            <!-- Collection Info -->
            <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div class="flex items-center gap-3">
                <div
                  v-if="collection.image"
                  class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100"
                >
                  <img
                    :src="collection.image"
                    :alt="collection.name"
                    class="w-full h-full object-cover"
                  />
                </div>
                <div
                  v-else
                  class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
                >
                  <span class="text-white text-sm font-bold">{{ getInitials(collection.name) }}</span>
                </div>
                <div class="flex-1">
                  <p class="font-medium text-gray-900 dark:text-white">{{ collection.name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    {{ collection.collection }} / {{ collection.category }} / {{ collection.type }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Mint Allowance Info -->
            <div class="mb-6 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="text-sm text-green-700 dark:text-green-300">
                    <span class="font-medium">Mint Allowance:</span>
                    {{ mintAllowanceFormatted }} NFTs
                  </p>
                </div>
              </div>
            </div>

            <!-- Class Selector (if collection has classes) -->
            <div v-if="hasClasses" class="mb-6">
              <label
                for="class-select"
                class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Select Class <span class="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                id="class-select"
                v-model="selectedClassKey"
                class="input w-full"
                :disabled="isMinting"
              >
                <option :value="null">Default (Collection Level)</option>
                <option
                  v-for="classItem in collection.classes"
                  :key="classItem.classKey"
                  :value="classItem.classKey"
                  :disabled="!classItem.canMintMore"
                >
                  {{ classItem.name }}
                  <template v-if="classItem.maxSupply !== '0'">
                    ({{ classItem.mintedCountFormatted }}/{{ classItem.maxSupplyFormatted }})
                  </template>
                  <template v-if="!classItem.canMintMore"> - Max Reached</template>
                </option>
              </select>
              <p v-if="!selectedClassKey" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Minting at collection level. Select a class for specific token types.
              </p>
            </div>

            <!-- Class Supply Info (if class selected) -->
            <div
              v-if="selectedClass && classSupplyRemaining"
              class="mb-6 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
            >
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <div>
                  <p class="text-sm text-purple-700 dark:text-purple-300">
                    <span class="font-medium">Class Supply:</span>
                    {{ selectedClass.mintedCountFormatted }} / {{ selectedClass.maxSupplyFormatted }} minted
                    ({{ classSupplyRemaining }} remaining)
                  </p>
                </div>
              </div>
            </div>

            <!-- Mint Form -->
            <form @submit.prevent="goToConfirmation">
              <!-- Quantity -->
              <div class="mb-6">
                <label
                  for="quantity"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Quantity to Mint
                </label>
                <div class="flex items-center gap-2">
                  <!-- Decrement button -->
                  <button
                    type="button"
                    class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isMinting || parseInt(quantity, 10) <= 1"
                    @click="decrementQuantity"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
                    </svg>
                  </button>

                  <!-- Input -->
                  <input
                    id="quantity"
                    v-model="quantity"
                    type="text"
                    inputmode="numeric"
                    placeholder="1"
                    class="input flex-1 text-center"
                    :class="{ 'border-red-500 dark:border-red-500': quantityError }"
                    :disabled="isMinting"
                  />

                  <!-- Increment button -->
                  <button
                    type="button"
                    class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    :disabled="isMinting || parseInt(quantity, 10) >= maxMintQuantity"
                    @click="incrementQuantity"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>

                  <!-- Max button -->
                  <button
                    type="button"
                    class="px-3 py-2 text-sm font-medium text-green-600 hover:text-green-500 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    :disabled="isMinting || maxMintQuantity <= 0"
                    @click="setMaxQuantity"
                  >
                    MAX
                  </button>
                </div>
                <p v-if="quantityError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {{ quantityError }}
                </p>
                <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  <template v-if="maxMintQuantity > 0">
                    You can mint up to {{ maxMintQuantity }} NFT{{ maxMintQuantity !== 1 ? 's' : '' }}.
                  </template>
                  <template v-else>
                    No more NFTs can be minted from this {{ selectedClass ? 'class' : 'collection' }}.
                  </template>
                </p>
              </div>

              <!-- Recipient -->
              <div class="mb-6">
                <label
                  for="recipient"
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Mint To
                </label>
                <input
                  id="recipient"
                  v-model="recipient"
                  type="text"
                  :placeholder="ownerAddress || 'eth|... or 0x...'"
                  class="input w-full font-mono text-sm"
                  :disabled="isMinting"
                />
                <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Leave empty to mint to your own wallet.
                </p>
              </div>
            </form>
          </div>

          <!-- Confirmation View -->
          <div v-else>
            <div class="space-y-4">
              <!-- Collection/Class Preview -->
              <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div class="flex items-center gap-3 mb-4">
                  <div
                    v-if="collection.image"
                    class="w-16 h-16 rounded-lg overflow-hidden bg-gray-100"
                  >
                    <img
                      :src="collection.image"
                      :alt="collection.name"
                      class="w-full h-full object-cover"
                    />
                  </div>
                  <div
                    v-else
                    class="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center"
                  >
                    <span class="text-white text-lg font-bold">{{ getInitials(collection.name) }}</span>
                  </div>
                  <div class="flex-1">
                    <p class="font-medium text-gray-900 dark:text-white">{{ collection.name }}</p>
                    <p v-if="selectedClass" class="text-sm text-purple-600 dark:text-purple-400">
                      Class: {{ selectedClass.name }}
                    </p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ collection.type }}
                    </p>
                  </div>
                </div>

                <!-- Mint Summary -->
                <div class="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-500 dark:text-gray-400">Collection</span>
                    <span class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ collection.name }}
                    </span>
                  </div>
                  <div v-if="selectedClass" class="flex justify-between">
                    <span class="text-sm text-gray-500 dark:text-gray-400">Class</span>
                    <span class="text-sm font-medium text-purple-600 dark:text-purple-400">
                      {{ selectedClass.name }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-500 dark:text-gray-400">Quantity to Mint</span>
                    <span class="text-sm font-medium text-green-600 dark:text-green-400">
                      +{{ quantity }} NFT{{ parseInt(quantity, 10) !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-sm text-gray-500 dark:text-gray-400">Recipient</span>
                    <span
                      class="text-sm font-mono text-gray-900 dark:text-white"
                      :title="effectiveRecipient"
                    >
                      {{ truncateAddress(effectiveRecipient) }}
                    </span>
                  </div>
                  <div class="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <FeeEstimate method="MintToken" :dto="mintDtoForEstimate" />
                  </div>
                </div>
              </div>

              <!-- Info Notice -->
              <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div class="flex items-start gap-2">
                  <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p class="text-sm text-blue-700 dark:text-blue-300">
                    Minting will create {{ quantity }} new NFT{{ parseInt(quantity, 10) !== 1 ? 's' : '' }} in your wallet. Each NFT will have a unique instance ID. This action requires signing with your wallet.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <template v-if="!collection">
          <button
            type="button"
            class="flex-1 btn-secondary"
            @click="handleClose"
          >
            Close
          </button>
        </template>
        <template v-else-if="!showConfirmation">
          <button
            type="button"
            class="flex-1 btn-secondary"
            :disabled="isMinting"
            @click="handleClose"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 btn-primary bg-green-600 hover:bg-green-700"
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
            :disabled="isMinting"
            @click="goBackToForm"
          >
            Back
          </button>
          <button
            type="button"
            class="flex-1 btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-2"
            :disabled="isMinting"
            @click="confirmMint"
          >
            <LoadingSpinner v-if="isMinting" size="sm" />
            <span>{{ isMinting ? 'Minting...' : 'Confirm Mint' }}</span>
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
