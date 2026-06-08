<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NFTGrid from '@/components/nfts/NFTGrid.vue'
import CollectionFilter from '@/components/nfts/CollectionFilter.vue'
import ChannelFilter from '@/components/nfts/ChannelFilter.vue'
import NFTSortDropdown from '@/components/nfts/NFTSortDropdown.vue'
import NFTPagination from '@/components/nfts/NFTPagination.vue'
import TransferNFTModal from '@/components/nfts/TransferNFTModal.vue'
import MintNFTModal from '@/components/nfts/MintNFTModal.vue'
import BurnNFTModal from '@/components/nfts/BurnNFTModal.vue'
import { useNFTs } from '@/composables/useNFTs'
import { useNFTMintAuthority } from '@/composables/useNFTMintAuthority'
import type { NFTDisplay, CollectionDisplay } from '@shared/types/display'

const {
  nfts,
  collections,
  channels,
  selectedCollection,
  selectedChannel,
  isLoading,
  error,
  sortBy,
  isConnected,
  totalNFTCount,
  filteredCount,
  pageSize,
  currentPage,
  totalPages,
  fetchAll,
  setSort,
  setCollectionFilter,
  setChannelFilter,
  clearFilter,
  setPageSize,
  setPage,
} = useNFTs()

const hasActiveFilter = computed(() => !!selectedCollection.value || !!selectedChannel.value)

// NFT mint authority
const { hasAnyMintAuthority } = useNFTMintAuthority()

// Transfer modal state
const transferModalOpen = ref(false)
const selectedNFTForTransfer = ref<NFTDisplay | null>(null)

// Mint modal state
const mintModalOpen = ref(false)

// Burn modal state
const burnModalOpen = ref(false)
const selectedNFTForBurn = ref<NFTDisplay | null>(null)

// Fetch NFTs on mount if connected
onMounted(async () => {
  if (isConnected.value) {
    await fetchAll()
  }
})

// Handler functions for NFT actions
function handleTransfer(nft: NFTDisplay): void {
  selectedNFTForTransfer.value = nft
  transferModalOpen.value = true
}

function handleTransferClose(): void {
  transferModalOpen.value = false
  selectedNFTForTransfer.value = null
}

async function handleTransferSuccess(_nft: NFTDisplay): Promise<void> {
  // Refresh NFT list after successful transfer
  await fetchAll()
}

// Mint modal handlers
function handleMintOpen(): void {
  mintModalOpen.value = true
}

function handleMintClose(): void {
  mintModalOpen.value = false
}

async function handleMintSuccess(_collection: CollectionDisplay, _quantity: number): Promise<void> {
  // Refresh NFT list after successful mint
  await fetchAll()
}

function handleBurn(nft: NFTDisplay): void {
  selectedNFTForBurn.value = nft
  burnModalOpen.value = true
}

function handleBurnClose(): void {
  burnModalOpen.value = false
  selectedNFTForBurn.value = null
}

async function handleBurnSuccess(_nft: NFTDisplay): Promise<void> {
  // Refresh NFT list after successful burn
  await fetchAll()
}

async function handleRefresh(): Promise<void> {
  await fetchAll()
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <PageHeader
        title="NFTs"
        description="View and manage your NFT collection."
      />
      <!-- Mint Button (shown when user has mint authority) -->
      <button
        v-if="isConnected && hasAnyMintAuthority"
        class="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2 shrink-0"
        @click="handleMintOpen"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Mint NFT
      </button>
    </div>

    <!-- Not Connected State -->
    <EmptyState
      v-if="!isConnected"
      title="Connect Your Wallet"
      description="Connect your wallet to view and manage your NFT collection."
      icon="nfts"
    />

    <!-- Connected Content -->
    <template v-else>
      <!-- Error State -->
      <div
        v-if="error"
        class="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 mb-6"
      >
        <div class="flex items-start gap-3">
          <svg
            class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div class="flex-1">
            <h4 class="font-medium text-red-800 dark:text-red-300">
              Failed to load NFTs
            </h4>
            <p class="text-sm text-red-600 dark:text-red-400 mt-1">
              {{ error }}
            </p>
            <button
              class="text-sm text-red-700 dark:text-red-300 underline hover:no-underline mt-2"
              @click="handleRefresh"
            >
              Try again
            </button>
          </div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <!-- Count Display -->
        <div class="text-sm text-gray-600 dark:text-gray-400">
          <span v-if="hasActiveFilter">
            Showing {{ filteredCount }} of {{ totalNFTCount }} NFTs
          </span>
          <span v-else-if="totalNFTCount > 0">
            {{ totalNFTCount }} NFTs
          </span>
        </div>

        <!-- Filter & Sort Controls -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Channel Filter -->
          <ChannelFilter
            v-if="channels.length > 1"
            :channels="channels"
            :model-value="selectedChannel"
            @update:model-value="setChannelFilter"
          />

          <!-- Collection Filter -->
          <CollectionFilter
            v-if="collections.length > 1"
            :collections="collections"
            :model-value="selectedCollection"
            @update:model-value="setCollectionFilter"
          />

          <!-- Clear Filter Button -->
          <button
            v-if="hasActiveFilter"
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Clear filters"
            @click="clearFilter"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <!-- Sort Dropdown -->
          <NFTSortDropdown
            :model-value="sortBy"
            @update:model-value="setSort"
          />

          <!-- Refresh Button -->
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            :class="{ 'animate-spin': isLoading }"
            :disabled="isLoading"
            title="Refresh"
            @click="handleRefresh"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      <!-- NFT Grid -->
      <NFTGrid
        :nfts="nfts"
        :is-loading="isLoading"
        @transfer="handleTransfer"
        @burn="handleBurn"
      />

      <!-- Pagination -->
      <NFTPagination
        v-if="filteredCount > 0"
        :current-page="currentPage"
        :total-pages="totalPages"
        :page-size="pageSize"
        :filtered-count="filteredCount"
        @update:page="setPage"
        @update:page-size="setPageSize"
      />
    </template>

    <!-- Transfer NFT Modal -->
    <TransferNFTModal
      :nft="selectedNFTForTransfer"
      :open="transferModalOpen"
      @close="handleTransferClose"
      @success="handleTransferSuccess"
    />

    <!-- Mint NFT Modal -->
    <MintNFTModal
      :open="mintModalOpen"
      @close="handleMintClose"
      @success="handleMintSuccess"
    />

    <!-- Burn NFT Modal -->
    <BurnNFTModal
      :nft="selectedNFTForBurn"
      :open="burnModalOpen"
      @close="handleBurnClose"
      @success="handleBurnSuccess"
    />
  </div>
</template>
