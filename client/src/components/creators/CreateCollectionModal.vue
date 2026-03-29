<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useForm, useField } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useNftCollectionAuth } from '@/composables/useNftCollectionAuth'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

interface Props {
  open: boolean
  preselectedCollection?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  success: []
}>()

// Composables
const {
  isClaiming,
  isCreating,
  error: authError,
  clearError,
  claimCollectionName,
  createCollection,
  pendingCollections,
  fetchAuthorizations,
} = useNftCollectionAuth()

// Dialog ref
const dialogRef = ref<HTMLDialogElement | null>(null)

// Flow state: 'claim' -> 'create' -> 'confirm'
const flowStep = ref<'claim' | 'create' | 'confirm'>('claim')
const claimedCollectionName = ref<string>('')
const localError = ref<string | null>(null)
const showAdvanced = ref(false)

// ============================================================================
// Step 1: Claim Collection Name
// ============================================================================

const claimSchema = toTypedSchema(
  z.object({
    collectionName: z
      .string()
      .min(1, 'Collection name is required')
      .max(50, 'Collection name must be 50 characters or less')
      .regex(/^[a-zA-Z0-9-_]+$/, 'Only letters, numbers, hyphens and underscores allowed'),
  })
)

const {
  handleSubmit: handleClaimSubmit,
  resetForm: resetClaimForm,
  meta: claimMeta,
} = useForm({
  validationSchema: claimSchema,
  initialValues: { collectionName: '' },
})

const { value: collectionName, errorMessage: collectionNameError } = useField<string>('collectionName')

const canClaim = computed(() => claimMeta.value.valid && !isClaiming.value)

// ============================================================================
// Step 2: Create Collection Details
// ============================================================================

const createSchema = toTypedSchema(
  z.object({
    category: z.string().min(1, 'Category is required').regex(/^[a-zA-Z0-9-_]+$/, 'Invalid format'),
    type: z.string().min(1, 'Type is required').regex(/^[a-zA-Z0-9-_]+$/, 'Invalid format'),
    additionalKey: z.string().regex(/^[a-zA-Z0-9-_]*$/, 'Invalid format').optional(),
    name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
    symbol: z.string().min(1, 'Symbol is required').max(10, 'Symbol must be 10 characters or less'),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    image: z.string().url('Must be a valid URL').min(1, 'Image URL is required'),
    maxSupply: z.string().optional().refine(
      (val) => !val || /^\d+$/.test(val),
      'Must be a positive whole number'
    ),
    rarity: z.string().optional(),
  })
)

const {
  handleSubmit: handleCreateSubmit,
  resetForm: resetCreateForm,
  meta: createMeta,
} = useForm({
  validationSchema: createSchema,
  initialValues: {
    category: 'Item',
    type: '',
    additionalKey: 'none',
    name: '',
    symbol: '',
    description: '',
    image: '',
    maxSupply: '',
    rarity: '',
  },
})

const { value: category, errorMessage: categoryError } = useField<string>('category')
const { value: type, errorMessage: typeError } = useField<string>('type')
const { value: additionalKey, errorMessage: additionalKeyError } = useField<string>('additionalKey')
const { value: name, errorMessage: nameError } = useField<string>('name')
const { value: symbol, errorMessage: symbolError } = useField<string>('symbol')
const { value: description, errorMessage: descriptionError } = useField<string>('description')
const { value: image, errorMessage: imageError } = useField<string>('image')
const { value: maxSupply, errorMessage: maxSupplyError } = useField<string>('maxSupply')
const { value: rarity, errorMessage: rarityError } = useField<string>('rarity')

const canCreate = computed(() => createMeta.value.valid && !isCreating.value)

// ============================================================================
// Computed
// ============================================================================

const isLoading = computed(() => isClaiming.value || isCreating.value)
const displayError = computed(() => localError.value || authError.value)

// Collection key preview
const collectionKeyPreview = computed(() => {
  if (!claimedCollectionName.value) return ''
  const cat = category.value || 'category'
  const t = type.value || 'type'
  const ak = additionalKey.value || 'none'
  return `${claimedCollectionName.value}|${cat}|${t}|${ak}`
})

// Format max supply for display
function formatMaxSupply(value: string): string {
  if (!value) return 'Unlimited'
  const num = parseInt(value, 10)
  return isNaN(num) ? 'Unlimited' : num.toLocaleString()
}

// ============================================================================
// Dialog management
// ============================================================================

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    showDialog()
  } else {
    hideDialog()
  }
})

function showDialog() {
  if (dialogRef.value) {
    dialogRef.value.showModal()
    resetAllState()
    // If a collection name is preselected, skip to step 2
    if (props.preselectedCollection) {
      claimedCollectionName.value = props.preselectedCollection
      flowStep.value = 'create'
    }
  }
}

function hideDialog() {
  if (dialogRef.value) {
    dialogRef.value.close()
  }
}

function resetAllState() {
  flowStep.value = 'claim'
  claimedCollectionName.value = ''
  localError.value = null
  showAdvanced.value = false
  clearError()
  resetClaimForm()
  resetCreateForm()
  // Re-set default values
  collectionName.value = ''
  category.value = 'Item'
  type.value = ''
  additionalKey.value = 'none'
  name.value = ''
  symbol.value = ''
  description.value = ''
  image.value = ''
  maxSupply.value = ''
  rarity.value = ''
}

function handleClose() {
  resetAllState()
  emit('close')
}

function handleDialogClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (target === dialogRef.value) {
    handleClose()
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose()
  }
}

// ============================================================================
// Flow navigation
// ============================================================================

// Step 1: Claim collection name
const submitClaim = handleClaimSubmit(async () => {
  localError.value = null

  const result = await claimCollectionName(collectionName.value)

  if (result.success) {
    claimedCollectionName.value = collectionName.value
    flowStep.value = 'create'
  } else {
    localError.value = result.error || 'Failed to claim collection name'
  }
})

// Step 2: Fill in collection details -> go to confirmation
const goToConfirmation = handleCreateSubmit(() => {
  flowStep.value = 'confirm'
  localError.value = null
})

// Go back from confirmation to create
function goBackToCreate() {
  flowStep.value = 'create'
}

// Go back from create to claim (start over)
function goBackToClaim() {
  flowStep.value = 'claim'
  claimedCollectionName.value = ''
}

// Step 3: Confirm and create
async function confirmCreate() {
  localError.value = null

  const result = await createCollection({
    collection: claimedCollectionName.value,
    category: category.value,
    type: type.value,
    additionalKey: additionalKey.value || 'none',
    name: name.value,
    symbol: symbol.value,
    description: description.value || '',
    image: image.value,
    ...(maxSupply.value && { maxSupply: maxSupply.value }),
    ...(rarity.value && { rarity: rarity.value }),
  })

  if (result.success) {
    emit('success')
    handleClose()
  } else {
    localError.value = result.error || 'Failed to create collection'
  }
}

// Use an existing claimed collection
function useClaimedCollection(name: string) {
  claimedCollectionName.value = name
  flowStep.value = 'create'
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  if (props.open) {
    showDialog()
  }
  window.addEventListener('keydown', handleKeyDown)
  // Fetch existing authorizations
  fetchAuthorizations()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <dialog
    ref="dialogRef"
    class="fixed inset-0 m-0 w-full h-full max-w-none max-h-none bg-white dark:bg-gray-900 rounded-none shadow-2xl backdrop:bg-black/50 p-0 open:flex open:flex-col sm:inset-auto sm:m-auto sm:w-full sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-xl"
    @click="handleDialogClick"
  >
    <div class="flex flex-col h-full sm:max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ flowStep === 'claim' ? 'Claim Collection Name' :
               flowStep === 'create' ? 'Create new NFT' :
               'Confirm Collection' }}
          </h2>
          <!-- Step indicator -->
          <div class="flex items-center gap-2 mt-1">
            <div
              class="w-2 h-2 rounded-full"
              :class="flowStep === 'claim' ? 'bg-gala-primary' : 'bg-green-500'"
            />
            <span class="text-xs text-gray-500">Step 1: Claim</span>
            <div class="w-4 h-px bg-gray-300 dark:bg-gray-600" />
            <div
              class="w-2 h-2 rounded-full"
              :class="flowStep === 'claim' ? 'bg-gray-300 dark:bg-gray-600' :
                      flowStep === 'create' ? 'bg-gala-primary' : 'bg-green-500'"
            />
            <span class="text-xs text-gray-500">Step 2: Create</span>
            <div class="w-4 h-px bg-gray-300 dark:bg-gray-600" />
            <div
              class="w-2 h-2 rounded-full"
              :class="flowStep === 'confirm' ? 'bg-gala-primary' : 'bg-gray-300 dark:bg-gray-600'"
            />
            <span class="text-xs text-gray-500">Step 3: Confirm</span>
          </div>
        </div>
        <button
          type="button"
          class="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :disabled="isLoading"
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

        <!-- ===== STEP 1: CLAIM COLLECTION NAME ===== -->
        <div v-if="flowStep === 'claim'">
          <!-- Info about the two-step process -->
          <div class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div class="flex items-start gap-2">
              <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-sm text-blue-700 dark:text-blue-300">
                <p class="font-medium">Two-Step Collection Creation</p>
                <p class="mt-1">First, claim a unique collection name to reserve it. Then, fill in the collection details and create it.</p>
              </div>
            </div>
          </div>

          <form @submit.prevent="submitClaim" class="space-y-4">
            <!-- Collection Name -->
            <div>
              <label for="collectionName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Collection Name *
              </label>
              <input
                id="collectionName"
                v-model="collectionName"
                type="text"
                placeholder="my-awesome-collection"
                class="input w-full"
                :class="{ 'border-red-500 dark:border-red-500': collectionNameError }"
                :disabled="isClaiming"
              />
              <p v-if="collectionNameError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                {{ collectionNameError }}
              </p>
              <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Letters, numbers, hyphens and underscores only. This will be your unique collection identifier.
              </p>
            </div>
          </form>

          <!-- Existing claimed collections -->
          <div v-if="pendingCollections.length > 0" class="mt-6">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Or use a previously claimed name:
            </h3>
            <div class="space-y-2">
              <button
                v-for="claimed in pendingCollections"
                :key="claimed.collection"
                type="button"
                class="w-full p-3 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                @click="useClaimedCollection(claimed.collection)"
              >
                <span class="font-medium text-gray-900 dark:text-white">{{ claimed.collection }}</span>
                <span class="text-xs text-green-600 dark:text-green-400 ml-2">Claimed</span>
              </button>
            </div>
          </div>
        </div>

        <!-- ===== STEP 2: CREATE COLLECTION DETAILS ===== -->
        <div v-if="flowStep === 'create'">
          <!-- Claimed collection badge -->
          <div class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span class="text-sm text-green-700 dark:text-green-300">
                Collection name claimed: <strong>{{ claimedCollectionName }}</strong>
              </span>
            </div>
          </div>

          <form @submit.prevent="goToConfirmation" class="space-y-6">
            <!-- Basic Info Section -->
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Basic Information
              </h3>

              <!-- Name -->
              <div class="mb-4">
                <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name *
                </label>
                <input
                  id="name"
                  v-model="name"
                  type="text"
                  placeholder="My Awesome NFT"
                  class="input w-full"
                  :class="{ 'border-red-500 dark:border-red-500': nameError }"
                  :disabled="isCreating"
                />
                <p v-if="nameError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {{ nameError }}
                </p>
              </div>

              <!-- Symbol -->
              <div class="mb-4">
                <label for="symbol" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Symbol *
                </label>
                <input
                  id="symbol"
                  v-model="symbol"
                  type="text"
                  placeholder="MANFT"
                  maxlength="10"
                  class="input w-full uppercase"
                  :class="{ 'border-red-500 dark:border-red-500': symbolError }"
                  :disabled="isCreating"
                />
                <p v-if="symbolError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {{ symbolError }}
                </p>
                <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Short identifier (max 10 characters)
                </p>
              </div>

              <!-- Description -->
              <div class="mb-4">
                <label for="description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  v-model="description"
                  rows="3"
                  placeholder="Describe your NFT"
                  class="input w-full resize-none"
                  :class="{ 'border-red-500 dark:border-red-500': descriptionError }"
                  :disabled="isCreating"
                />
                <p v-if="descriptionError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {{ descriptionError }}
                </p>
              </div>

              <!-- Image URL -->
              <div class="mb-4">
                <label for="image" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Image URL *
                </label>
                <input
                  id="image"
                  v-model="image"
                  type="url"
                  placeholder="https://example.com/image.png"
                  class="input w-full"
                  :class="{ 'border-red-500 dark:border-red-500': imageError }"
                  :disabled="isCreating"
                />
                <p v-if="imageError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                  {{ imageError }}
                </p>
                <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  URL to collection image (HTTPS recommended)
                </p>
              </div>
            </div>

            <!-- Token Key Section -->
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Token Identifiers
              </h3>

              <div class="grid grid-cols-2 gap-4">
                <!-- Category -->
                <div>
                  <label for="category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category *
                  </label>
                  <input
                    id="category"
                    v-model="category"
                    type="text"
                    placeholder="Item"
                    class="input w-full"
                    :class="{ 'border-red-500 dark:border-red-500': categoryError }"
                    :disabled="isCreating"
                  />
                  <p v-if="categoryError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {{ categoryError }}
                  </p>
                </div>

                <!-- Type -->
                <div>
                  <label for="type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type *
                  </label>
                  <input
                    id="type"
                    v-model="type"
                    type="text"
                    placeholder="Broadsword"
                    class="input w-full"
                    :class="{ 'border-red-500 dark:border-red-500': typeError }"
                    :disabled="isCreating"
                  />
                  <p v-if="typeError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {{ typeError }}
                  </p>
                </div>

                <!-- Additional Key -->
                <div class="col-span-2">
                  <label for="additionalKey" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Additional Key
                  </label>
                  <input
                    id="additionalKey"
                    v-model="additionalKey"
                    type="text"
                    placeholder="Rare"
                    class="input w-full"
                    :class="{ 'border-red-500 dark:border-red-500': additionalKeyError }"
                    :disabled="isCreating"
                  />
                  <p v-if="additionalKeyError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {{ additionalKeyError }}
                  </p>
                </div>
              </div>

              <!-- Key Preview -->
              <div class="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
                {{ collectionKeyPreview || 'collection|category|type|additionalKey' }}
              </div>
            </div>

            <!-- Advanced Options -->
            <div>
              <button
                type="button"
                class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                @click="showAdvanced = !showAdvanced"
              >
                <svg
                  class="w-4 h-4 transition-transform"
                  :class="{ 'rotate-90': showAdvanced }"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
                Advanced Options
              </button>

              <div v-if="showAdvanced" class="mt-3 space-y-4">
                <!-- Max Supply -->
                <div>
                  <label for="maxSupply" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Supply
                  </label>
                  <input
                    id="maxSupply"
                    v-model="maxSupply"
                    type="text"
                    inputmode="numeric"
                    placeholder="Leave empty for unlimited"
                    class="input w-full"
                    :class="{ 'border-red-500 dark:border-red-500': maxSupplyError }"
                    :disabled="isCreating"
                  />
                  <p v-if="maxSupplyError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {{ maxSupplyError }}
                  </p>
                  <p v-else class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Maximum number of NFTs that can be minted
                  </p>
                </div>

                <!-- Rarity -->
                <div>
                  <label for="rarity" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rarity
                  </label>
                  <input
                    id="rarity"
                    v-model="rarity"
                    type="text"
                    placeholder="e.g., Legendary, Epic, Rare"
                    class="input w-full"
                    :class="{ 'border-red-500 dark:border-red-500': rarityError }"
                    :disabled="isCreating"
                  />
                  <p v-if="rarityError" class="mt-1 text-sm text-red-600 dark:text-red-400">
                    {{ rarityError }}
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>

        <!-- ===== STEP 3: CONFIRMATION ===== -->
        <div v-if="flowStep === 'confirm'">
          <div class="space-y-4">
            <!-- Collection Preview -->
            <div class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
              <div class="flex items-center gap-3 mb-4">
                <div
                  v-if="image"
                  class="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700"
                >
                  <img :src="image" :alt="name" class="w-full h-full object-cover" />
                </div>
                <div
                  v-else
                  class="w-12 h-12 rounded-lg bg-gradient-to-br from-gala-primary to-gala-secondary flex items-center justify-center text-white font-bold"
                >
                  {{ symbol.slice(0, 2).toUpperCase() }}
                </div>
                <div>
                  <p class="font-semibold text-gray-900 dark:text-white">{{ name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400">{{ symbol }}</p>
                </div>
              </div>

              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Collection Name</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ claimedCollectionName }}</span>
              </div>
              <div class="flex justify-between gap-4">
                <span class="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">Token Key</span>
                <span class="text-sm font-mono text-gray-900 dark:text-white break-all text-right">
                  {{ collectionKeyPreview }}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Max Supply</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatMaxSupply(maxSupply) }}
                </span>
              </div>
              <div v-if="rarity" class="flex justify-between">
                <span class="text-sm text-gray-500 dark:text-gray-400">Rarity</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ rarity }}</span>
              </div>
              <div v-if="description" class="pt-2 border-t border-gray-200 dark:border-gray-700">
                <span class="text-sm text-gray-500 dark:text-gray-400 block mb-1">Description</span>
                <p class="text-sm text-gray-900 dark:text-white">{{ description }}</p>
              </div>
            </div>

            <!-- Info Notice -->
            <div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="text-sm text-blue-700 dark:text-blue-300">
                  <p class="font-medium">Creating this NFT collection will:</p>
                  <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>Register the NFT collection on GalaChain</li>
                    <li>Make you the collection authority</li>
                    <li>Allow you to mint NFTs from this collection</li>
                  </ul>
                  <p class="mt-2">This action requires signing with your wallet.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <!-- Step 1: Claim -->
        <template v-if="flowStep === 'claim'">
          <button
            type="button"
            class="flex-1 btn-secondary"
            :disabled="isClaiming"
            @click="handleClose"
          >
            Cancel
          </button>
          <button
            type="button"
            class="flex-1 btn-primary flex items-center justify-center gap-2"
            :disabled="!canClaim"
            @click="submitClaim"
          >
            <LoadingSpinner v-if="isClaiming" size="sm" />
            <span>{{ isClaiming ? 'Claiming...' : 'Claim Name' }}</span>
          </button>
        </template>

        <!-- Step 2: Create -->
        <template v-else-if="flowStep === 'create'">
          <button
            type="button"
            class="flex-1 btn-secondary"
            :disabled="isCreating"
            @click="goBackToClaim"
          >
            Back
          </button>
          <button
            type="button"
            class="flex-1 btn-primary"
            :disabled="!canCreate"
            @click="goToConfirmation"
          >
            Continue
          </button>
        </template>

        <!-- Step 3: Confirm -->
        <template v-else>
          <button
            type="button"
            class="flex-1 btn-secondary"
            :disabled="isCreating"
            @click="goBackToCreate"
          >
            Back
          </button>
          <button
            type="button"
            class="flex-1 btn-primary flex items-center justify-center gap-2"
            :disabled="isCreating"
            @click="confirmCreate"
          >
            <LoadingSpinner v-if="isCreating" size="sm" />
            <span>{{ isCreating ? 'Creating...' : 'Create Collection' }}</span>
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
