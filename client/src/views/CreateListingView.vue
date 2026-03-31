<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import SellNFTModal from '@/components/marketplace/SellNFTModal.vue'
import { useWallet } from '@/composables/useWallet'
import { useCreatorCollectionsStore, type CreatorClassDisplay } from '@/stores/creatorCollections'
import { useNftCollectionAuth } from '@/composables/useNftCollectionAuth'
import { useCreatorCollections } from '@/composables/useCreatorCollections'
import { fetchTokenClasses } from '@/lib/galachainClient'
import BigNumber from 'bignumber.js'

const router = useRouter()
const { connected } = useWallet()
const collectionsStore = useCreatorCollectionsStore()
const { fetchAuthorizations } = useNftCollectionAuth()
const { fetchCollections } = useCreatorCollections()

const fulfillerAddress = import.meta.env.VITE_FULFILLER_ADDRESS || ''

const showModal = ref(false)
const allClasses = ref<CreatorClassDisplay[]>([])
const isLoadingClasses = ref(true)

onMounted(async () => {
  if (!connected.value) {
    isLoadingClasses.value = false
    return
  }

  try {
    // Fetch authorizations to get collection names
    await Promise.all([fetchAuthorizations(), fetchCollections()])

    // Fetch classes for all claimed collections
    const claimed = collectionsStore.claimedCollections
    const classPromises = claimed.map(async (c) => {
      try {
        const response = await fetchTokenClasses({ collection: c.collection }, { limit: 100 })
        return response.results.map((tc): CreatorClassDisplay => {
          const maxSupply = new BigNumber(tc.maxSupply?.toString() || '0')
          const totalMinted = new BigNumber(tc.knownMintSupply?.toString() || tc.totalSupply?.toString() || '0')
          return {
            classKey: `${tc.collection}|${tc.category}|${tc.type}|${tc.additionalKey}`,
            collection: tc.collection,
            category: tc.category,
            type: tc.type,
            additionalKey: tc.additionalKey,
            name: tc.name || tc.type || 'Unnamed',
            maxSupply: maxSupply.toString(),
            maxSupplyFormatted: maxSupply.isZero() ? 'Unlimited' : maxSupply.toFormat(0),
            mintedCount: totalMinted.toString(),
            mintedCountFormatted: totalMinted.toFormat(0),
            canMintMore: maxSupply.isZero() || totalMinted.isLessThan(maxSupply),
          }
        })
      } catch {
        return []
      }
    })

    const results = await Promise.all(classPromises)
    allClasses.value = results.flat()
  } catch {
    // Silently handle
  } finally {
    isLoadingClasses.value = false
    if (allClasses.value.length > 0) {
      showModal.value = true
    }
  }
})

function handleSuccess() {
  showModal.value = false
  router.push('/marketplace')
}

function openModal() {
  showModal.value = true
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
      title="Sell NFT"
      description="List one of your NFT classes for sale on the marketplace."
    />

    <div v-if="!connected" class="text-center py-8 text-gray-500">
      Connect your wallet to create a listing.
    </div>

    <div v-else-if="isLoadingClasses" class="flex justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>

    <div v-else-if="allClasses.length === 0" class="text-center py-12">
      <p class="text-gray-500 mb-4">You don't have any NFT classes to sell yet.</p>
      <RouterLink to="/creators" class="btn-primary">
        Go to Creators to create NFTs
      </RouterLink>
    </div>

    <div v-else class="text-center py-12">
      <p class="text-gray-600 mb-4">You have {{ allClasses.length }} NFT class{{ allClasses.length !== 1 ? 'es' : '' }} available to sell.</p>
      <button class="btn-primary text-lg px-8 py-3" @click="openModal">
        Choose an NFT to Sell
      </button>
    </div>

    <SellNFTModal
      :open="showModal"
      :nft-class="null"
      :available-classes="allClasses"
      :fulfiller-address="fulfillerAddress"
      @close="showModal = false"
      @success="handleSuccess"
    />
  </div>
</template>
