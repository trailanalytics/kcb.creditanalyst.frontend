import type { Tile } from './types'

/** The CRB dashboard (home.blade.php) with each tile's and menu entry's gate. */
export const CRB_TILES: Tile[] = [
  {
    title: 'CAP',
    subtitle: 'Credit Applications',
    icon: 'credit.png',
    to: '/applications',
    footer: 'Manage Credit Applications',
    menu: [
      { label: 'Applications Report', to: '/applications/report' },
      { label: 'Bulk Approval', to: '/applications/bulk-approve' },
      { label: 'Auto-Approval Reviews', to: '/auto-approval-reviews', permission: 'Resolve Auto-Approvals' },
      { label: 'Non Existing Customer', action: 'non-existing-customer' },
      { label: 'Joint Application', action: 'joint-application' },
    ],
  },
  {
    title: 'CBA',
    subtitle: 'Running Loans',
    icon: '/img/empty.svg',
    to: '/loans',
    footer: 'Review Credit Accounts',
    menu: [
      { label: 'Update CBA Accounts', to: '/cba/output', permission: 'Update CBA Details' },
      { label: 'Upload Credit Cards', to: '/upload-credit-cards' },
      { label: 'Open Accounts', to: '/open-accounts' },
      { label: 'Written-off Credit Account', to: '/write-offs' },
      { label: 'Ignore Loan Accounts', to: '/ignored-accounts' },
      { label: 'Force Close Accounts', to: '/force-closed-accounts' },
      { label: 'Upload Fully Paid/Written Off', to: '/upload-fully-paid-or-write-offs' },
      { label: 'Fix CBA Issues', to: '/cba/fix', permission: 'Update CBA Details' },
    ],
  },
  {
    title: 'BC',
    subtitle: 'Bounce Cheques',
    icon: 'cheque.png',
    to: '/upload-bounced-cheques',
    footer: 'Upload Bounced Cheques',
  },
  {
    title: 'INSTITUTION',
    subtitle: 'Head Office/Branch',
    icon: 'institution.png',
    to: '/branches',
    footer: 'Manage Branches',
    menu: [{ label: 'New Branch', to: '/branches/new' }],
  },
  {
    title: 'PIS',
    subtitle: 'PI Stakeholder',
    icon: 'manage.png',
    to: '/pis',
    footer: '+ New PI Stakeholder',
  },
  {
    title: 'BS',
    subtitle: 'Borrower Stakeholder',
    icon: 'borrowerstakeholder.png',
    to: '/bs-list',
    footer: '+ Borrower Stakeholder',
  },
  {
    title: 'REPORTS',
    subtitle: 'CBA & CRB Reports',
    icon: 'reports.jpg',
    to: '/reports',
    footer: 'CRB Reports',
    permission: 'Download Crb Reports',
    menu: [
      { label: 'Loans Without CMC,CCG,BS', to: '/reports/loans-without-cmc-bs-ccg' },
      { label: 'Submission Analysis', to: '/reports/submission-analysis' },
    ],
  },
  {
    title: 'ANALYSIS',
    subtitle: 'PR4 vs CBA Analysis',
    icon: 'analysis.jpg',
    to: '/analysis',
    footer: 'Run Analysis',
    permission: 'View Analysis',
  },
  {
    title: 'PROCESSES',
    subtitle: 'Background Processes',
    icon: 'background-process.jpg',
    to: '/background-processes',
    footer: 'View Processes',
    permission: 'View Analysis',
  },
  {
    title: 'CMC',
    subtitle: 'Collateral Material',
    icon: 'collateral.png',
    to: '/cmc-list',
    footer: 'Manage Collateral',
  },
  {
    title: 'CCG',
    subtitle: 'Collateral Credit Guarantor',
    icon: 'guarantor.png',
    to: '/ccg-list',
    footer: 'Manage Borrower Guarantor',
  },
  {
    title: 'FRA',
    subtitle: 'Financial Malpractice',
    icon: 'malpractice.png',
    to: '/fraud',
    footer: '+ New Financial Malpractice',
  },
]

/** admin/dashboard.blade.php. The original footer link for "Configurations" and its title link pointed at different pages. */
export const ADMIN_TILES: Tile[] = [
  {
    title: 'Users',
    subtitle: 'Staff and admins',
    icon: 'guy-in-tie.png',
    to: '/users',
    footer: 'Manage Users',
  },
  {
    title: 'Statistics',
    subtitle: 'logs and statistics',
    icon: 'excel-template.png',
    to: '/logs',
    footer: 'Manage Logs and statistics',
  },
  {
    title: 'Configurations',
    subtitle: 'Configurations',
    icon: 'configuration.png',
    to: '/admin/configuration',
    footer: 'Manage system',
  },
]
