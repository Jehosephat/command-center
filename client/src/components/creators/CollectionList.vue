<script setup lang="ts">
/**
 * CollectionList.vue
 * Displays a list of creator collections with loading and empty states.
 * Also shows pending (claimed but not created) collections with expandable class lists.
 */
import CollectionCard from './CollectionCard.vue'
import CollectionCardSkeleton from './CollectionCardSkeleton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { CreatorCollectionDisplay, ClaimedCollectionDisplay } from '@/stores/creatorCollections'

defineProps<{
  collections: CreatorCollectionDisplay[]
  pendingCollections?: ClaimedCollectionDisplay[]
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'mint', collection: CreatorCollectionDisplay): void
  (e: 'manageClasses', collection: CreatorCollectionDisplay): void
  (e: 'toggleExpand', collectionKey: string): void
  (e: 'togglePendingExpand', collectionName: string): void
  (e: 'addClassToPending', collectionName: string): void
}>()
</script>

<template>
  <div class="collection-list">
    <!-- Loading State -->
    <div v-if="isLoading && collections.length === 0 && (!pendingCollections || pendingCollections.length === 0)" class="space-y-4">
      <CollectionCardSkeleton v-for="i in 3" :key="i" />
    </div>

    <!-- Empty State (only if no collections AND no pending collections) -->
    <EmptyState
      v-else-if="!isLoading && collections.length === 0 && (!pendingCollections || pendingCollections.length === 0)"
      title="No Collections Found"
      description="You don't have authority over any collections yet. Create a new collection to get started."
      icon="collections"
    />

    <!-- Content (collections and/or pending collections exist) -->
    <div v-else class="space-y-6">
      <!-- Existing Collection Cards -->
      <div v-if="collections.length > 0" class="space-y-4">
        <CollectionCard
          v-for="collection in collections"
          :key="collection.collectionKey"
          :collection="collection"
          @mint="emit('mint', $event)"
          @manage-classes="emit('manageClasses', $event)"
          @toggle-expand="emit('toggleExpand', $event)"
        />
      </div>

      <!-- Pending Collections (claimed but not created) -->
      <div v-if="pendingCollections && pendingCollections.length > 0">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="pending in pendingCollections"
            :key="pending.collection"
            class="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden transition-colors"
            :class="{ 'sm:col-span-2 lg:col-span-3': pending.isExpanded }"
          >
            <!-- Header (always visible) -->
            <button
              class="w-full p-4 text-left hover:bg-amber-100 transition-colors group"
              @click="emit('togglePendingExpand', pending.collection)"
            >
              <div class="flex items-center justify-between">
                <span class="font-medium text-gray-900">{{ pending.collection }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">Claimed</span>
                  <svg
                    class="w-4 h-4 text-gray-400 transition-transform"
                    :class="{ 'rotate-180': pending.isExpanded }"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <p class="text-sm text-gray-500 mt-1 group-hover:text-gray-700">
                Click to view NFT classes
              </p>
            </button>

            <!-- Expanded section -->
            <div v-if="pending.isExpanded" class="px-4 pb-4 border-t border-amber-200">
              <!-- Loading state for classes -->
              <div v-if="!pending.classesFetched" class="py-3 text-center text-sm text-gray-500">
                Loading classes...
              </div>

              <!-- Classes list -->
              <div v-else-if="pending.classes.length > 0" class="pt-3">
                <h4 class="text-sm font-medium text-gray-700 mb-2">
                  NFT Classes ({{ pending.classes.length }})
                </h4>
                <div class="space-y-2">
                  <div
                    v-for="classItem in pending.classes"
                    :key="classItem.classKey"
                    class="p-2 bg-white rounded-lg text-sm border border-amber-100"
                  >
                    <div class="flex items-center justify-between">
                      <span class="font-medium text-gray-900">{{ classItem.name }}</span>
                      <span class="text-gray-500 text-xs">
                        {{ classItem.mintedCountFormatted }} / {{ classItem.maxSupplyFormatted === '0' ? '∞' : classItem.maxSupplyFormatted }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-400 mt-0.5 truncate" :title="classItem.classKey">
                      {{ classItem.classKey }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- No classes -->
              <div v-else class="py-3 text-center text-sm text-gray-500">
                No classes created yet.
              </div>

              <!-- Action buttons -->
              <div class="mt-3">
                <button
                  class="btn-primary text-sm"
                  @click.stop="emit('addClassToPending', pending.collection)"
                >
                  <span class="flex items-center gap-1.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Class
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
