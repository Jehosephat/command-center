<script setup lang="ts">
/**
 * CreatorsView.vue
 * Main creators page with Pump Interface, NFT Collection Tools, and My Collections sections
 */
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import PumpEntry from '@/components/creators/PumpEntry.vue'
import CollectionList from '@/components/creators/CollectionList.vue'
import CreateCollectionModal from '@/components/creators/CreateCollectionModal.vue'
import CreateClassModal from '@/components/creators/CreateClassModal.vue'
import CollectionMintModal from '@/components/creators/CollectionMintModal.vue'
import { useWallet } from '@/composables/useWallet'
import { useCreatorCollections } from '@/composables/useCreatorCollections'
import { useNftCollectionAuth } from '@/composables/useNftCollectionAuth'
import { useCreatorCollectionsStore, type CreatorCollectionDisplay, type CreatorClassDisplay } from '@/stores/creatorCollections'

const { connected } = useWallet()

// NFT Collection Authorizations (claimed collection names)
const {
  fetchAuthorizations,
} = useNftCollectionAuth()
const collectionsStore = useCreatorCollectionsStore()
const {
  collections,
  isLoading,
  error,
  hasCollections,
  totalCollectionCount,
  fetchCollections,
  refresh,
  toggleExpanded,
  togglePendingExpanded,
} = useCreatorCollections()

// Pending collections from the store (has expansion/class state)
const pendingCollections = computed(() => collectionsStore.pendingClaimedCollections)

// Track if initial fetch has happened
const hasFetched = ref(false)

// Modal states
const showCreateCollectionModal = ref(false)
const showCreateClassModal = ref(false)
const showMintModal = ref(false)
const selectedCollectionForClass = ref<CreatorCollectionDisplay | null>(null)
const selectedCollectionForMint = ref<CreatorCollectionDisplay | null>(null)
const selectedClassForMint = ref<CreatorClassDisplay | null>(null)
const preselectedCollectionName = ref<string | null>(null)

// Fetch collections on mount if connected
onMounted(async () => {
  if (connected.value) {
    await Promise.all([
      fetchCollections(),
      fetchAuthorizations(),
    ])
    hasFetched.value = true
  }
})

/**
 * Handle refresh button click
 */
async function handleRefresh() {
  await refresh(true)
}

/**
 * Open create collection modal
 */
function openCreateCollectionModal(collectionName?: string) {
  preselectedCollectionName.value = collectionName || null
  showCreateCollectionModal.value = true
}

/**
 * Close create collection modal
 */
function closeCreateCollectionModal() {
  showCreateCollectionModal.value = false
  preselectedCollectionName.value = null
}

/**
 * Handle successful collection creation
 */
async function handleCollectionCreated() {
  showCreateCollectionModal.value = false
  // Refresh collections to show the new one
  await refresh(true)
}

/**
 * Handle mint from collection - opens the mint modal
 */
function handleMint(collection: CreatorCollectionDisplay) {
  selectedCollectionForMint.value = collection
  selectedClassForMint.value = null
  showMintModal.value = true
}

/**
 * Close mint modal
 */
function closeMintModal() {
  showMintModal.value = false
  selectedCollectionForMint.value = null
  selectedClassForMint.value = null
}

/**
 * Handle successful mint
 */
async function handleMintSuccess(
  _collection: CreatorCollectionDisplay,
  _quantity: number,
  _classItem?: CreatorClassDisplay
) {
  showMintModal.value = false
  selectedCollectionForMint.value = null
  selectedClassForMint.value = null
  // Refresh collections to update minted counts
  await refresh(true)
}

/**
 * Handle manage classes - open the create class modal for this collection
 */
function handleManageClasses(collection: CreatorCollectionDisplay) {
  selectedCollectionForClass.value = collection
  showCreateClassModal.value = true
}

/**
 * Close create class modal
 */
function closeCreateClassModal() {
  showCreateClassModal.value = false
  selectedCollectionForClass.value = null
}

/**
 * Handle successful class creation
 */
async function handleClassCreated() {
  showCreateClassModal.value = false
  selectedCollectionForClass.value = null
  // Refresh collections to show the new class
  await refresh(true)
}

/**
 * Handle toggle expand
 */
function handleToggleExpand(collectionKey: string) {
  toggleExpanded(collectionKey)
}

/**
 * Handle toggle expand for a pending/claimed collection
 */
function handleTogglePendingExpand(collectionName: string) {
  togglePendingExpanded(collectionName)
}

/**
 * Handle add class to a pending collection
 * Opens the CreateCollectionModal with collection pre-selected (skips claim step)
 */
function handleAddClassToPending(collectionName: string) {
  openCreateCollectionModal(collectionName)
}
</script>

<template>
  <div>
    <PageHeader
      title="Creators"
      description="Create and manage your token collections."
    />

    <!-- Wallet not connected prompt -->
    <EmptyState
      v-if="!connected"
      title="Connect Your Wallet"
      description="Connect your wallet to access creator tools and manage your collections."
      icon="collections"
    />

    <template v-else>
      <!-- Pump Interface Section -->
      <section class="pump-section mb-8">
        <PumpEntry />
      </section>

      <!-- Visual Divider -->
      <div class="divider relative my-10">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-gray-200"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="px-4 bg-gray-50 text-sm text-gray-500 font-medium">NFT Collection Tools</span>
        </div>
      </div>

      <!-- NFT Collection Tools Section -->
      <section class="nft-tools-section">
        <div>
          <!-- Create Collection Card -->
          <div class="card hover:shadow-md transition-shadow">
            <div class="flex items-start gap-4">
              <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div class="flex-1">
                <h3 class="text-lg font-semibold text-gray-900 mb-1">Create Collection</h3>
                <p class="text-gray-500 text-sm mb-4">
                  Start a new NFT collection with custom name, symbol, and properties.
                </p>
                <button
                  class="btn-primary text-sm"
                  @click="openCreateCollectionModal()"
                >
                  <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Create New
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- My Collections Section -->
        <div class="mt-8">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-semibold text-gray-900">My Collections</h3>
              <span
                v-if="hasCollections || (pendingCollections && pendingCollections.length > 0)"
                class="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
              >
                {{ totalCollectionCount + (pendingCollections?.length || 0) }}
              </span>
            </div>

            <!-- Refresh Button -->
            <button
              class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              :disabled="isLoading"
              @click="handleRefresh"
            >
              <LoadingSpinner v-if="isLoading" size="sm" />
              <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>

          <!-- Error Display -->
          <div v-if="error" class="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p class="text-sm font-medium text-red-800">Failed to load collections</p>
                <p class="text-sm text-red-600 mt-1">{{ error }}</p>
                <button
                  class="mt-2 text-sm text-red-700 hover:text-red-800 underline"
                  @click="handleRefresh"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>

          <!-- Collections List (includes pending collections) -->
          <CollectionList
            :collections="collections"
            :pending-collections="pendingCollections"
            :is-loading="isLoading"
            @mint="handleMint"
            @manage-classes="handleManageClasses"
            @toggle-expand="handleToggleExpand"
            @toggle-pending-expand="handleTogglePendingExpand"
            @add-class-to-pending="handleAddClassToPending"
          />
        </div>
      </section>

      <!-- Create Collection Modal -->
      <CreateCollectionModal
        :open="showCreateCollectionModal"
        :preselected-collection="preselectedCollectionName"
        @close="closeCreateCollectionModal"
        @success="handleCollectionCreated"
      />

      <!-- Create Class Modal -->
      <CreateClassModal
        :open="showCreateClassModal"
        :collection="selectedCollectionForClass"
        @close="closeCreateClassModal"
        @success="handleClassCreated"
      />

      <!-- Collection Mint Modal -->
      <CollectionMintModal
        :open="showMintModal"
        :collection="selectedCollectionForMint"
        :selected-class="selectedClassForMint"
        @close="closeMintModal"
        @success="handleMintSuccess"
      />
    </template>
  </div>
</template>
