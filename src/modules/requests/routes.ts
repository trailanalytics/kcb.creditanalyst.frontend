import type { RouteRecordRaw } from 'vue-router'

/**
 * The deletion requests page (maker-checker). Laravel path; replaces the `/requests` placeholder. Without `View Deletion Requests` the router
 * shows the 403 page (Laravel redirected back with "You don't have permissions to this service. Contact a super admin").
 */
export const requestRoutes: RouteRecordRaw[] = [
  {
    path: '/requests',
    name: 'requests',
    component: () => import('./RequestsPage.vue'),
    meta: { title: 'Requests', permission: 'View Deletion Requests' },
  },
]
