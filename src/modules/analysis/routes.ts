import type { RouteRecordRaw } from 'vue-router'

/**
 * The PR4 upload and its analysis against the CBA. Laravel paths; `/analysis` replaces the placeholder of the same path. The old
 * `/upload-pr4` form could never succeed (it sent no reporting month), so it only forwards to the real page.
 */
export const analysisRoutes: RouteRecordRaw[] = [
  {
    path: '/analysis',
    name: 'analysis',
    component: () => import('./AnalysisPage.vue'),
    meta: { title: 'PR4 vs CBA Analysis', permission: 'View Analysis' },
  },
  {
    path: '/analysis/pr4/results',
    name: 'analysis-results',
    component: () => import('./AnalysisResultsPage.vue'),
    meta: { title: 'PR4 Analysis Results', permission: 'View Analysis' },
  },
  { path: '/upload-pr4', redirect: '/analysis' },
]
