import type { RouteRecordRaw } from 'vue-router'

/** Financial malpractice (FRA). Laravel path. */
export const fraudRoutes: RouteRecordRaw[] = [
  {
    path: '/fraud',
    name: 'fraud',
    component: () => import('./FraudPage.vue'),
    meta: { title: 'Financial Malpractice', permission: 'Manage FRA' },
  },
]
