import type { RouteRecordRaw } from 'vue-router'

/**
 * The T24 page: imports, commands, warehouse login, client number mapping and forex rates. `/t24` is the sub-nav link and
 * opens the same page as `/t24/sync`. Added to the app layout's children by the router.
 */
export const t24Routes: RouteRecordRaw[] = [
  {
    path: '/t24/sync',
    name: 't24-sync',
    component: () => import('./pages/T24SyncPage.vue'),
    meta: { title: 'T24 Sync', permission: 'Sync T24' },
  },
  {
    path: '/t24',
    name: 't24',
    component: () => import('./pages/T24SyncPage.vue'),
    meta: { title: 'T24 Sync', permission: 'Sync T24' },
  },
]

/** The admin Configuration page, for the admin layout's children. */
export const adminConfigRoutes: RouteRecordRaw[] = [
  {
    path: '/admin/configuration',
    name: 'admin-configuration',
    component: () => import('./pages/AdminConfigurationPage.vue'),
    meta: { title: 'Configuration', permission: 'Manage Configurations' },
  },
]
