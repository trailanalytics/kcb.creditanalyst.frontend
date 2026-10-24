import type { RouteRecordRaw } from 'vue-router'

/**
 * The CBA correction tools. Laravel paths (`/cba/modify-accounts` and `/cba/fix` there); `/cba/output` and `/cba/fix` replace the
 * placeholders of the same path. Both need `Update CBA Details`, which Laravel only used to hide the dashboard links.
 */
export const cbaFixRoutes: RouteRecordRaw[] = [
  {
    path: '/cba/output',
    name: 'cba-output',
    component: () => import('./OutputCbaPage.vue'),
    meta: { title: 'Update CBA Accounts', permission: 'Update CBA Details' },
  },
  {
    path: '/cba/fix',
    name: 'cba-fix',
    component: () => import('./CbaFixPage.vue'),
    meta: { title: 'Fix CBA Issues', permission: 'Update CBA Details' },
  },
]
