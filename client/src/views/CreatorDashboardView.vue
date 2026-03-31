<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import { useWallet } from '@/composables/useWallet'
import { useMarketplace } from '@/composables/useMarketplace'
import * as api from '@/lib/marketplaceApi'
import type { EnrichedListing, CreatorStats } from '@shared/types/marketplace'

const router = useRouter()
const { connected, address } = useWallet()
const { enrichListing } = useMarketplace()

const listings = ref<EnrichedListing[]>([])
const stats = ref<CreatorStats | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  if (!address.value) {
    isLoading.value = false
    return
  }
  try {
    const [rawListings, statsData] = await Promise.all([
      api.fetchListingsByCreator(address.value),
      api.fetchCreatorStats(address.value),
    ])
    listings.value = await Promise.all(rawListings.map(enrichListing))
    stats.value = statsData
  } catch {
    // Silently handle — empty state will show
  } finally {
    isLoading.value = false
  }
})

async function toggleListing(listing: EnrichedListing) {
  if (!address.value) return
  await api.updateListing(listing.id, {
    creatorAddress: address.value,
    isActive: !listing.isActive,
  })
  listing.isActive = !listing.isActive
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

    <PageHeader
      title="Creator Dashboard"
      description="Manage your marketplace listings and view sales stats."
    />

    <div v-if="!connected" class="text-center py-8 text-gray-500">
      Connect your wallet to view your dashboard.
    </div>

    <div v-else-if="isLoading" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else>
      <!-- Stats -->
      <div v-if="stats" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div class="card">
          <p class="text-sm text-gray-500">Total Listings</p>
          <p class="text-2xl font-bold text-gray-900">{{ stats.totalListings }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-gray-500">Active Listings</p>
          <p class="text-2xl font-bold text-green-600">{{ stats.activeListings }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-gray-500">Total Sold</p>
          <p class="text-2xl font-bold text-purple-600">{{ stats.totalSold }}</p>
        </div>
        <div class="card">
          <p class="text-sm text-gray-500">Total Revenue</p>
          <p class="text-2xl font-bold text-gray-900">{{ stats.totalRevenue }}</p>
        </div>
      </div>

      <!-- Listings -->
      <h3 class="text-lg font-semibold mb-4">Your Listings</h3>

      <div v-if="listings.length === 0" class="text-center py-8 text-gray-500">
        <p>You haven't created any listings yet.</p>
        <RouterLink to="/marketplace/create" class="btn-primary mt-4 inline-block">
          Create Your First Listing
        </RouterLink>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="listing in listings"
          :key="listing.id"
          class="card flex items-center justify-between"
        >
          <div class="flex items-center gap-3">
            <div
              v-if="listing.image"
              class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
            >
              <img :src="listing.image" :alt="listing.name" class="w-full h-full object-cover" />
            </div>
            <div>
              <h4 class="font-medium text-gray-900">{{ listing.name }}</h4>
              <p class="text-sm text-gray-500">
                {{ listing.priceAmount }} {{ listing.priceTokenCollection || 'GALA' }}
                <span class="mx-1">&middot;</span>
                {{ listing.totalSold }} sold
                <span v-if="listing.totalSupply"> / {{ listing.totalSupply }}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span
              class="text-xs px-2 py-1 rounded-full"
              :class="listing.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'"
            >
              {{ listing.isActive ? 'Active' : 'Inactive' }}
            </span>
            <button
              class="btn-secondary text-xs"
              @click="toggleListing(listing)"
            >
              {{ listing.isActive ? 'Deactivate' : 'Activate' }}
            </button>
            <button
              class="btn-secondary text-xs"
              @click="router.push(`/marketplace/${listing.id}`)"
            >
              View
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
