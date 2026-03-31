<script setup lang="ts">
import type { EnrichedListing } from '@shared/types/marketplace'

defineProps<{
  listing: EnrichedListing
}>()

const emit = defineEmits<{
  (e: 'click', listing: EnrichedListing): void
}>()

function formatPrice(amount: string, symbol: string): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return `${amount} ${symbol}`
  return `${num.toLocaleString()} ${symbol}`
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??'
}
</script>

<template>
  <button
    class="card hover:shadow-lg transition-all text-left w-full group"
    @click="emit('click', listing)"
  >
    <!-- Image -->
    <div class="aspect-square rounded-lg overflow-hidden bg-gray-100 mb-3">
      <img
        v-if="listing.image"
        :src="listing.image"
        :alt="listing.name"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform"
      />
      <div
        v-else
        class="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center"
      >
        <span class="text-white text-2xl font-bold">{{ getInitials(listing.name) }}</span>
      </div>
    </div>

    <!-- Info -->
    <h3 class="font-semibold text-gray-900 truncate">{{ listing.name }}</h3>
    <p class="text-sm text-gray-500 truncate">{{ listing.collection }}</p>

    <!-- Price -->
    <div class="mt-2 flex items-center justify-between">
      <span class="text-lg font-bold text-purple-600">
        {{ formatPrice(listing.priceAmount, listing.priceTokenCollection || 'GALA') }}
      </span>
      <span v-if="listing.totalSupply" class="text-xs text-gray-400">
        {{ listing.totalSold }}/{{ listing.totalSupply }} sold
      </span>
    </div>
  </button>
</template>
