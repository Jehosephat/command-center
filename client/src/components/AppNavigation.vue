<script setup lang="ts">
import { useRoute } from 'vue-router'

defineProps<{
  mobile?: boolean
}>()

const route = useRoute()

const navItems = [
  {
    name: 'Tokens',
    to: '/tokens',
    icon: 'coins',
  },
  {
    name: 'NFTs',
    to: '/nfts',
    icon: 'image',
  },
  {
    name: 'Creators',
    to: '/creators',
    icon: 'sparkles',
  },
  {
    name: 'Marketplace',
    to: '/marketplace',
    icon: 'store',
  },
  {
    name: 'Export',
    to: '/export',
    icon: 'download',
    comingSoon: true,
  },
]

const isActive = (to: string) => {
  if (to === '/tokens' && route.path === '/') return true
  if (to === '/marketplace') return route.path.startsWith('/marketplace')
  return route.path === to
}
</script>

<template>
  <!-- Desktop Navigation (horizontal tabs) -->
  <nav
    v-if="!mobile"
    class="flex items-center gap-1"
    role="navigation"
    aria-label="Main navigation"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="relative px-4 py-2 text-sm font-medium rounded-lg transition-colors"
      :class="[
        isActive(item.to)
          ? 'text-gala-primary bg-gala-light'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      ]"
    >
      <span class="flex items-center gap-2">
        <!-- Icons -->
        <svg v-if="item.icon === 'coins'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <svg v-else-if="item.icon === 'image'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <svg v-else-if="item.icon === 'sparkles'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
        <svg v-else-if="item.icon === 'store'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <svg v-else-if="item.icon === 'download'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {{ item.name }}
        <span
          v-if="item.comingSoon"
          class="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded"
        >
          Soon
        </span>
      </span>
      <!-- Active indicator -->
      <span
        v-if="isActive(item.to)"
        class="absolute bottom-0 left-2 right-2 h-0.5 bg-gala-primary rounded-full"
      />
    </RouterLink>
  </nav>

  <!-- Mobile Navigation (horizontal scrollable) -->
  <nav
    v-else
    class="flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-hide"
    role="navigation"
    aria-label="Main navigation"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      class="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
      :class="[
        isActive(item.to)
          ? 'text-gala-primary bg-gala-light'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      ]"
    >
      <span class="flex items-center gap-2">
        {{ item.name }}
        <span
          v-if="item.comingSoon"
          class="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded"
        >
          Soon
        </span>
      </span>
    </RouterLink>
  </nav>
</template>

<style scoped>
/* Hide scrollbar for mobile navigation */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
