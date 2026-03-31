<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PurchaseModal from '@/components/marketplace/PurchaseModal.vue'
import { useWallet } from '@/composables/useWallet'
import { useMarketplace } from '@/composables/useMarketplace'
import * as api from '@/lib/marketplaceApi'
import type { EnrichedListing, ListingStats } from '@shared/types/marketplace'

const route = useRoute()
const router = useRouter()
const { connected } = useWallet()
const { fetchAndEnrichListing } = useMarketplace()

const listing = ref<EnrichedListing | null>(null)
const stats = ref<ListingStats | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const showPurchaseModal = ref(false)

const fulfillerAddress = import.meta.env.VITE_FULFILLER_ADDRESS || ''

const remaining = computed(() => {
  if (!listing.value || listing.value.totalSupply === null) return null
  return listing.value.totalSupply - listing.value.totalSold
})

onMounted(async () => {
  const id = route.params.id as string
  try {
    const [listingData, statsData] = await Promise.all([
      fetchAndEnrichListing(id),
      api.fetchListingStats(id),
    ])
    listing.value = listingData
    stats.value = statsData
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load listing'
  } finally {
    isLoading.value = false
  }
})

function handlePurchaseSuccess() {
  showPurchaseModal.value = false
  // Refresh listing data
  if (listing.value) {
    fetchAndEnrichListing(listing.value.id).then(l => { listing.value = l })
    api.fetchListingStats(listing.value.id).then(s => { stats.value = s })
  }
}
</script>

<template>
  <div>
    <button
      class="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      @click="router.push('/marketplace')"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Marketplace
    </button>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-sm text-red-700">{{ error }}</p>
    </div>

    <!-- Listing detail -->
    <div v-else-if="listing" class="grid gap-8 md:grid-cols-2">
      <!-- Left: Image -->
      <div class="aspect-square rounded-xl overflow-hidden bg-gray-100">
        <img
          v-if="listing.image"
          :src="listing.image"
          :alt="listing.name"
          class="w-full h-full object-cover"
        />
        <div
          v-else
          class="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center"
        >
          <span class="text-white text-5xl font-bold">
            {{ listing.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }}
          </span>
        </div>
      </div>

      <!-- Right: Details -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 mb-1">{{ listing.name }}</h1>
        <p class="text-gray-500 mb-4">{{ listing.collection }} / {{ listing.category }} / {{ listing.type }}</p>

        <p v-if="listing.description" class="text-gray-700 mb-6">{{ listing.description }}</p>

        <!-- Price -->
        <div class="p-4 bg-purple-50 rounded-lg mb-6">
          <p class="text-sm text-gray-500 mb-1">Price</p>
          <p class="text-3xl font-bold text-purple-600">
            {{ listing.priceAmount }} {{ listing.priceTokenCollection || 'GALA' }}
          </p>
          <p class="text-sm text-gray-500 mt-1">Platform fee: {{ listing.platformFeePercent }}%</p>
        </div>

        <!-- Supply -->
        <div class="flex gap-4 mb-6 text-sm">
          <div class="flex-1 p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">Sold</p>
            <p class="text-lg font-semibold">{{ listing.totalSold }}</p>
          </div>
          <div v-if="listing.totalSupply !== null" class="flex-1 p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">Remaining</p>
            <p class="text-lg font-semibold">{{ remaining }}</p>
          </div>
          <div v-if="stats" class="flex-1 p-3 bg-gray-50 rounded-lg">
            <p class="text-gray-500">Buyers</p>
            <p class="text-lg font-semibold">{{ stats.uniqueBuyers }}</p>
          </div>
        </div>

        <!-- Buy button -->
        <button
          v-if="listing.isActive && connected"
          class="btn-primary w-full text-lg py-3"
          :disabled="remaining !== null && remaining <= 0"
          @click="showPurchaseModal = true"
        >
          {{ remaining !== null && remaining <= 0 ? 'Sold Out' : 'Buy Now' }}
        </button>
        <p v-else-if="!connected" class="text-center text-gray-500">
          Connect your wallet to purchase.
        </p>
        <p v-else-if="!listing.isActive" class="text-center text-gray-500">
          This listing is no longer active.
        </p>
      </div>
    </div>

    <!-- Purchase Modal -->
    <PurchaseModal
      :open="showPurchaseModal"
      :listing="listing"
      :fulfiller-address="fulfillerAddress"
      @close="showPurchaseModal = false"
      @success="handlePurchaseSuccess"
    />
  </div>
</template>
