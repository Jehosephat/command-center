<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import ListingCard from '@/components/marketplace/ListingCard.vue'
import { useMarketplace } from '@/composables/useMarketplace'
import { useWallet } from '@/composables/useWallet'
import type { EnrichedListing } from '@shared/types/marketplace'

const router = useRouter()
const { connected } = useWallet()
const { listings, total, isLoading, error, fetchListings } = useMarketplace()

const search = ref('')

onMounted(() => {
  fetchListings()
})

function handleSearch() {
  fetchListings({ search: search.value || undefined })
}

function handleListingClick(listing: EnrichedListing) {
  router.push(`/marketplace/${listing.id}`)
}
</script>

<template>
  <div>
    <PageHeader
      title="Marketplace"
      description="Browse and purchase NFTs from creators."
    />

    <!-- Actions bar -->
    <div class="flex items-center justify-between mb-6 gap-4">
      <!-- Search -->
      <div class="flex-1 max-w-md">
        <div class="relative">
          <input
            v-model="search"
            type="text"
            placeholder="Search listings..."
            class="input w-full pl-10"
            @keydown.enter="handleSearch"
          />
          <svg class="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Create listing link -->
      <RouterLink
        v-if="connected"
        to="/marketplace/create"
        class="btn-primary text-sm flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Sell NFT
      </RouterLink>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p class="text-sm text-red-700">{{ error }}</p>
    </div>

    <!-- Empty -->
    <EmptyState
      v-else-if="listings.length === 0"
      title="No Listings Yet"
      description="No NFTs are currently listed for sale. Be the first to list one!"
      icon="collections"
    />

    <!-- Listings grid -->
    <div v-else class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      <ListingCard
        v-for="listing in listings"
        :key="listing.id"
        :listing="listing"
        @click="handleListingClick"
      />
    </div>

    <!-- Total count -->
    <p v-if="total > 0" class="mt-4 text-sm text-gray-500 text-center">
      Showing {{ listings.length }} of {{ total }} listing{{ total !== 1 ? 's' : '' }}
    </p>
  </div>
</template>
