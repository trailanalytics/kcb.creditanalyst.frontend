import type { RouteRecordRaw } from 'vue-router'

/**
 * The Background Processes page. Laravel path; replaces the `/background-processes` placeholder. Everyone signed in may open it (they see their own
 * processes; `Manage Background Processes` sees all and gets the kill, mark complete and retry buttons), unlike the placeholder, which asked for View Analysis.
 */
export const processRoutes: RouteRecordRaw[] = [
  {
    path: '/background-processes',
    name: 'background-processes',
    component: () => import('./ProcessesPage.vue'),
    meta: { title: 'Background Processes' },
  },
]
