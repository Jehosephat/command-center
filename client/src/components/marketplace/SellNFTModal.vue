<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useWallet } from '@/composables/useWallet'
import { useCreateListing } from '@/composables/useCreateListing'
import type { CreatorClassDisplay } from '@/stores/creatorCollections'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import FeeEstimate from '@/components/ui/FeeEstimate.vue'
import BigNumber from 'bignumber.js'

const props = defineProps<{
  open: boolean
  /** Pre-selected NFT class (from Creators page). If null, show a dropdown. */
  nftClass: CreatorClassDisplay | null
  /** All available NFT classes for the dropdown (from Marketplace page). */
  availableClasses?: CreatorClassDisplay[]
  /** Fulfiller wallet address for grant allowance */
  fulfillerAddress: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success'): void
}>()

const { address } = useWallet()
const { isGranting, isCreating, error, clearError, grantMintAllowance, createListing } = useCreateListing()

const dialogRef = ref<HTMLDialogElement | null>(null)

// Form state
const selectedClassKey = ref<string | null>(null)
const priceAmount = ref('')
const priceTokenCollection = ref('GALA')
const totalSupply = ref('')
const maxPerWallet = ref('')
const step = ref<'form' | 'processing' | 'done'>('form')

// Resolve which class we're selling
const activeClass = computed((): CreatorClassDisplay | null => {
  if (props.nftClass) return props.nftClass
  if (!selectedClassKey.value || !props.availableClasses) return null
  return props.availableClasses.find(c => c.classKey === selectedClassKey.value) || null
})

const isProcessing = computed(() => isGranting.value || isCreating.value)

const canSubmit = computed(() => {
  return activeClass.value && priceAmount.value && !isProcessing.value
})

// Inner DTO used to estimate the GrantAllowance fee via DryRun
const grantAllowanceDtoForEstimate = computed(() => {
  const nft = activeClass.value
  if (!nft) return null

  // Figure out the allowance quantity the way handleSubmit will
  let supply: number
  if (totalSupply.value) {
    supply = parseInt(totalSupply.value)
  } else {
    const maxSup = parseInt(nft.maxSupply || '0')
    const minted = parseInt(nft.mintedCount || '0')
    supply = maxSup > 0 ? maxSup - minted : 0
  }
  if (supply <= 0) return null

  return {
    tokenInstance: {
      collection: nft.collection,
      category: nft.category,
      type: nft.type,
      additionalKey: nft.additionalKey,
      instance: '0',
    },
    quantities: [{
      user: props.fulfillerAddress,
      quantity: new BigNumber(supply).toString(),
    }],
    allowanceType: 4,
    uses: new BigNumber(supply).toString(),
  }
})

watch(() => props.open, (isOpen) => {
  nextTick(() => {
    if (isOpen && dialogRef.value) {
      dialogRef.value.showModal()
      resetForm()
    } else if (!isOpen && dialogRef.value) {
      dialogRef.value.close()
    }
  })
})

function resetForm() {
  selectedClassKey.value = null
  priceAmount.value = ''
  priceTokenCollection.value = 'GALA'
  totalSupply.value = ''
  maxPerWallet.value = ''
  step.value = 'form'
  clearError()
}

function handleClose() {
  resetForm()
  emit('close')
}

function handleDialogClick(e: MouseEvent) {
  if (e.target === dialogRef.value) handleClose()
}

async function handleSubmit() {
  const nft = activeClass.value
  if (!nft || !address.value || !canSubmit.value) return

  clearError()
  step.value = 'processing'

  // Step 1: Grant mint allowance to fulfiller
  // Use the user-specified supply, or remaining class supply, whichever applies
  let supply: number
  if (totalSupply.value) {
    supply = parseInt(totalSupply.value)
  } else {
    const maxSup = parseInt(nft.maxSupply || '0')
    const minted = parseInt(nft.mintedCount || '0')
    supply = maxSup > 0 ? maxSup - minted : 0
  }

  if (supply <= 0) {
    error.value = 'No remaining supply to sell'
    step.value = 'form'
    return
  }
  const granted = await grantMintAllowance(
    {
      collection: nft.collection,
      category: nft.category,
      type: nft.type,
      additionalKey: nft.additionalKey,
    },
    props.fulfillerAddress,
    String(supply),
  )

  if (!granted) {
    step.value = 'form'
    return
  }

  // Step 2: Create listing in backend
  const listing = await createListing({
    creatorAddress: address.value,
    collection: nft.collection,
    category: nft.category,
    type: nft.type,
    additionalKey: nft.additionalKey,
    priceAmount: priceAmount.value,
    priceTokenCollection: priceTokenCollection.value,
    priceTokenCategory: 'Unit',
    priceTokenType: 'none',
    priceTokenAdditionalKey: 'none',
    ...(totalSupply.value && { totalSupply: parseInt(totalSupply.value) }),
    ...(maxPerWallet.value && { maxPerWallet: parseInt(maxPerWallet.value) }),
  })

  if (listing) {
    step.value = 'done'
    setTimeout(() => {
      emit('success')
      handleClose()
    }, 1500)
  } else {
    step.value = 'form'
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
        <h2 class="text-lg font-semibold text-gray-900">Sell NFT</h2>
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

      <!-- Success state -->
      <div v-if="step === 'done'" class="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div class="w-16 h-16 mb-4 bg-green-100 rounded-full flex items-center justify-center">
          <svg class="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-gray-900">Listed for Sale!</h3>
        <p class="text-gray-500 mt-1">Your NFT is now on the marketplace.</p>
      </div>

      <!-- Processing state -->
      <div v-else-if="step === 'processing'" class="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <LoadingSpinner size="lg" class="mb-4" />
        <h3 class="text-lg font-semibold text-gray-900">
          {{ isGranting ? 'Granting Mint Allowance' : 'Creating Listing' }}
        </h3>
        <p class="text-gray-500 mt-1">
          {{ isGranting ? 'Please confirm in your wallet...' : 'Saving your listing...' }}
        </p>
      </div>

      <!-- Form -->
      <form v-else class="flex-1 overflow-y-auto px-6 py-4 space-y-5" @submit.prevent="handleSubmit">
        <!-- Error -->
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-700">{{ error }}</p>
        </div>

        <!-- NFT selector (dropdown mode — no pre-selected class) -->
        <div v-if="!nftClass && availableClasses">
          <label class="block text-sm font-medium text-gray-700 mb-1">Select NFT Class *</label>
          <select v-model="selectedClassKey" class="input w-full">
            <option :value="null" disabled>Choose an NFT class...</option>
            <option
              v-for="cls in availableClasses"
              :key="cls.classKey"
              :value="cls.classKey"
            >
              {{ cls.name }} ({{ cls.collection }} / {{ cls.category }} / {{ cls.type }})
            </option>
          </select>
        </div>

        <!-- NFT info (pre-selected mode) -->
        <div v-else-if="nftClass" class="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <p class="font-medium text-gray-900">{{ nftClass.name }}</p>
          <p class="text-sm text-gray-500">{{ nftClass.classKey }}</p>
        </div>

        <!-- Price -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Price per NFT *</label>
            <input v-model="priceAmount" type="text" inputmode="decimal" class="input w-full" placeholder="10" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Payment Token</label>
            <select v-model="priceTokenCollection" class="input w-full">
              <option value="GALA">GALA</option>
              <option value="GUSDT">GUSDT</option>
            </select>
          </div>
        </div>

        <!-- Limits -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Total Supply</label>
            <input v-model="totalSupply" type="number" min="1" class="input w-full" placeholder="Unlimited" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Max per Wallet</label>
            <input v-model="maxPerWallet" type="number" min="1" class="input w-full" placeholder="Unlimited" />
          </div>
        </div>

        <div v-if="grantAllowanceDtoForEstimate" class="pt-3 border-t border-gray-200">
          <FeeEstimate method="GrantAllowance" :dto="grantAllowanceDtoForEstimate" />
        </div>
      </form>

      <!-- Footer -->
      <div v-if="step === 'form'" class="px-6 py-4 border-t border-gray-200 flex gap-3">
        <button type="button" class="flex-1 btn-secondary" @click="handleClose">Cancel</button>
        <button
          type="button"
          class="flex-1 btn-primary"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          List for Sale
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
