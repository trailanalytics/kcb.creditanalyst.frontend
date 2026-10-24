import type { RouteRecordRaw } from 'vue-router'

/**
 * CRB reports, the two report pages, the submission analysis and the output files. Laravel paths; replaces the placeholders for
 * /reports, /reports/loans-without-cmc-bs-ccg, /reports/submission-analysis and /output-files. `/reports` forwards to the CRB form
 * (the old three-tab page was unreachable). The server enforces `Download Crb Reports` on all of them (Laravel did not).
 */
const permission = 'Download Crb Reports'

export const reportRoutes: RouteRecordRaw[] = [
  { path: '/reports', redirect: '/reports/crb' },
  {
    path: '/reports/crb',
    name: 'reports-crb',
    component: () => import('./CrbReportsPage.vue'),
    meta: { title: 'CRB Reports', permission },
  },
  {
    path: '/reports/loans-without-cmc-bs-ccg',
    name: 'reports-loans-without',
    component: () => import('./LoansWithoutPage.vue'),
    meta: { title: 'Loans Without CMC, CCG, BS', permission },
  },
  {
    path: '/reports/submission-analysis/:id?',
    name: 'reports-submission-analysis',
    component: () => import('./SubmissionAnalysisPage.vue'),
    props: true,
    meta: { title: 'Submission Analysis', permission },
  },
  {
    path: '/output-files',
    name: 'output-files',
    component: () => import('./OutputFilesPage.vue'),
    meta: { title: 'Output Files', permission },
  },
]
