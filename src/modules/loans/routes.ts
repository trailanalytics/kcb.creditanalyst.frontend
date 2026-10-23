import type { RouteRecordRaw } from 'vue-router'

/**
 * Loan accounts (CBA): the Laravel page URLs with their permission gates. Spread into the signed-in layout's children in
 * src/router/index.ts; it replaces the placeholders for /loans, /write-offs, /ignored-accounts, /force-closed-accounts,
 * /open-accounts, /upload-credit-cards and /off-balance-sheet.
 */
export const loansRoutes: RouteRecordRaw[] = [
  {
    path: 'loans',
    name: 'loans',
    component: () => import('./LoansPage.vue'),
    meta: { title: 'Loans', permission: 'View CBA Loans' },
  },
  {
    path: 'loans/show/:id(\\d+)',
    name: 'loan',
    component: () => import('./LoanShowPage.vue'),
    props: true,
    meta: { title: 'Loan Details', permission: 'CBA Loans Details' },
  },
  {
    path: 'loans/repayments/:id(\\d+)',
    name: 'loan-repayments',
    component: () => import('./RepaymentsPage.vue'),
    props: true,
    meta: { title: 'Loan Repayments', permission: 'CBA Loans Details' },
  },
  {
    path: 'loans/write-off/:id(\\d+)',
    name: 'loan-write-off',
    component: () => import('./WriteOffFormPage.vue'),
    props: true,
    meta: { title: 'Write Off Account', permission: 'Write-off Accounts' },
  },
  {
    path: 'write-offs',
    name: 'write-offs',
    component: () => import('./WriteOffsPage.vue'),
    meta: { title: 'Written-off Credit Accounts', permission: 'Manage Write-offs' },
  },
  {
    path: 'open-accounts',
    name: 'open-accounts',
    component: () => import('./OpenAccountsPage.vue'),
    meta: { title: 'Open Accounts', permission: 'Manage Open Accounts' },
  },
  {
    path: 'ignored-accounts',
    name: 'ignored-accounts',
    component: () => import('./IgnoredAccountsPage.vue'),
    meta: { title: 'Ignored Loan Accounts', permission: 'Ignore Accounts' },
  },
  {
    path: 'force-closed-accounts',
    name: 'force-closed-accounts',
    component: () => import('./ForceClosedAccountsPage.vue'),
    meta: { title: 'Force Closed Accounts', permission: 'View Force Closed Accounts' },
  },
  {
    path: 'upload-credit-cards',
    name: 'upload-credit-cards',
    component: () => import('./UploadCreditCardsPage.vue'),
    meta: { title: 'Upload Credit Cards', permission: 'Update CBA Details' },
  },
  {
    path: 'off-balance-sheet/items',
    name: 'off-balance-sheet',
    component: () => import('./OffBalanceSheetItemsPage.vue'),
    meta: { title: 'Off Balance Sheet Items', permission: 'View Off Balance Sheet Items' },
  },
  // the sub-nav and the placeholder list still point at the shorter path
  { path: 'off-balance-sheet', redirect: '/off-balance-sheet/items' },
]
