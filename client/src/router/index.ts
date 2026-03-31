import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/views/Layout.vue'),
      children: [
        {
          path: '',
          redirect: '/tokens',
        },
        {
          path: 'tokens',
          name: 'tokens',
          component: () => import('@/views/TokensView.vue'),
        },
        {
          path: 'nfts',
          name: 'nfts',
          component: () => import('@/views/NFTsView.vue'),
        },
        {
          path: 'creators',
          name: 'creators',
          component: () => import('@/views/CreatorsView.vue'),
        },
        {
          path: 'marketplace',
          name: 'marketplace',
          component: () => import('@/views/MarketplaceView.vue'),
        },
        {
          path: 'marketplace/create',
          name: 'marketplace-create',
          component: () => import('@/views/CreateListingView.vue'),
        },
        {
          path: 'marketplace/:id',
          name: 'marketplace-listing',
          component: () => import('@/views/ListingDetailView.vue'),
          props: true,
        },
        {
          path: 'marketplace/dashboard',
          name: 'marketplace-dashboard',
          component: () => import('@/views/CreatorDashboardView.vue'),
        },
        {
          path: 'export',
          name: 'export',
          component: () => import('@/views/ExportView.vue'),
        },
      ],
    },
  ],
})

export default router
