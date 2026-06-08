<script setup lang="ts">
import { computed } from 'vue'
import type { NFTDisplay } from '@shared/types/display'

interface Props {
  nft: NFTDisplay
}

const props = defineProps<Props>()

const emit = defineEmits<{
  transfer: [nft: NFTDisplay]
  burn: [nft: NFTDisplay]
}>()

// Format instance ID for display (truncate if very long)
const displayInstance = computed(() => {
  const instance = props.nft.instance
  if (instance.length > 8) {
    return `${instance.slice(0, 4)}...${instance.slice(-4)}`
  }
  return instance
})

// Get status color based on locked/in-use state
const statusBadge = computed(() => {
  if (props.nft.isLocked) {
    return { text: 'Locked', class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
  }
  if (props.nft.isInUse) {
    return { text: 'In Use', class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
  }
  return null
})
</script>

<template>
  <div class="card hover:shadow-md transition-shadow flex flex-col">
    <!-- NFT Image/Placeholder -->
    <div class="relative aspect-square mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-gala-primary/20 to-gala-secondary/20">
      <img
        v-if="nft.image"
        :src="nft.image"
        :alt="nft.name"
        class="w-full h-full object-cover"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center"
      >
        <svg
          class="w-16 h-16 text-gala-primary/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      <!-- Status Badge -->
      <div
        v-if="statusBadge"
        class="absolute top-2 left-2 px-2 py-0.5 text-xs font-medium rounded-full"
        :class="statusBadge.class"
      >
        {{ statusBadge.text }}
      </div>

      <!-- Burn Authority Badge -->
      <div
        v-if="nft.canBurn"
        class="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        title="You can burn this NFT"
      >
        Burn
      </div>
    </div>

    <!-- NFT Info -->
    <div class="flex-1 flex flex-col">
      <!-- Name & Collection -->
      <h3 class="font-semibold text-gray-900 dark:text-white truncate" :title="nft.name">
        {{ nft.name }}
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 truncate" :title="nft.collection">
        {{ nft.collection }}
      </p>

      <!-- Channel Badge -->
      <div class="mt-1">
        <span
          class="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gala-primary/10 text-gala-primary dark:bg-gala-primary/20"
          :title="`Channel: ${nft.channel}`"
        >
          {{ nft.channel }}
        </span>
      </div>

      <!-- Instance ID -->
      <div class="mt-2 flex items-center gap-2">
        <span class="text-xs text-gray-400 dark:text-gray-500">ID:</span>
        <span
          class="text-xs font-mono text-gray-600 dark:text-gray-300"
          :title="nft.instance"
        >
          #{{ displayInstance }}
        </span>
      </div>

      <!-- Rarity (if available) -->
      <div
        v-if="nft.rarity"
        class="mt-2"
      >
        <span
          class="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
        >
          {{ nft.rarity }}
        </span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-2 mt-4">
      <button
        class="btn-primary flex-1 text-sm py-2"
        :disabled="!nft.canTransfer"
        :title="nft.canTransfer ? 'Transfer this NFT' : 'NFT is locked or in use'"
        @click="emit('transfer', nft)"
      >
        Transfer
      </button>

      <button
        v-if="nft.canBurn"
        class="flex-1 text-sm py-2 px-4 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        @click="emit('burn', nft)"
      >
        Burn
      </button>
    </div>
  </div>
</template>
