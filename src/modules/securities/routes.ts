import type { RouteRecordRaw } from 'vue-router'

/** The CMC, CCG and BS lists. Add them as children of the app layout route, in place of the placeholder pages. */
export const securitiesRoutes: RouteRecordRaw[] = [
  {
    path: '/cmc-list',
    name: 'cmc-list',
    component: () => import('./CmcListPage.vue'),
    meta: { title: 'Collateral', permission: 'Manage Collateral' },
  },
  {
    path: '/ccg-list',
    name: 'ccg-list',
    component: () => import('./CcgListPage.vue'),
    meta: { title: 'Borrower Guarantor', permission: 'Manage Guarantors' },
  },
  {
    path: '/bs-list',
    name: 'bs-list',
    component: () => import('./BsListPage.vue'),
    meta: { title: 'Borrower Stakeholder', permission: 'Manage Stakeholder' },
  },
]
