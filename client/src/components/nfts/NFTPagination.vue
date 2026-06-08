<script setup lang="ts">
import { computed } from 'vue'
import { NFT_PAGE_SIZES, type NFTPageSize } from '@/stores/nfts'

interface Props {
  currentPage: number
  totalPages: number
  pageSize: NFTPageSize
  filteredCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: NFTPageSize]
}>()

const pageSizes = NFT_PAGE_SIZES

const rangeLabel = computed(() => {
  if (props.filteredCount === 0) return '0 of 0'
  const start = (props.currentPage - 1) * props.pageSize + 1
  const end = Math.min(props.currentPage * props.pageSize, props.filteredCount)
  return `${start}–${end} of ${props.filteredCount}`
})

const canPrev = computed(() => props.currentPage > 1)
const canNext = computed(() => props.currentPage < props.totalPages)

function onPageSizeChange(event: Event) {
  const value = Number((event.target as HTMLSelectElement).value) as NFTPageSize
  emit('update:pageSize', value)
}
</script>

<template>
  <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-6">
    <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
      <span>{{ rangeLabel }}</span>
      <span class="text-gray-300 dark:text-gray-600">•</span>
      <label class="flex items-center gap-2">
        <span>Per page:</span>
        <select
          class="px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-gala-primary"
          :value="pageSize"
          @change="onPageSizeChange"
        >
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }}</option>
        </select>
      </label>
    </div>

    <div class="flex items-center gap-1">
      <button
        class="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        :disabled="!canPrev"
        @click="emit('update:page', currentPage - 1)"
      >
        Prev
      </button>
      <span class="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
        Page {{ currentPage }} of {{ totalPages }}
      </span>
      <button
        class="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        :disabled="!canNext"
        @click="emit('update:page', currentPage + 1)"
      >
        Next
      </button>
    </div>
  </div>
</template>
