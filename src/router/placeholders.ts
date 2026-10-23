/**
 * Screens that exist in the Laravel app but are not ported yet. They keep their Laravel URL and permission gate so the
 * navigation, bookmarks and access rules already behave; each shows which milestone brings the real page.
 */
export interface Placeholder {
  path: string
  title: string
  milestone: string
  permission?: string
  layout?: 'app' | 'admin'
}

export const PLACEHOLDERS: Placeholder[] = [
  { path: '/profiles', title: 'Profiles', milestone: 'M3' },
  { path: '/applications', title: 'Credit Applications', milestone: 'M3' },
  { path: '/applications/report', title: 'Applications Report', milestone: 'M3' },
  { path: '/applications/bulk-approve', title: 'Bulk Approval', milestone: 'M3' },
  { path: '/applications/non-existing-customer', title: 'Non Existing Customer', milestone: 'M3' },
  { path: '/applications/joint', title: 'Joint Application', milestone: 'M3' },
  {
    path: '/auto-approval-reviews',
    title: 'Auto-Approval Reviews',
    milestone: 'M9',
    permission: 'Resolve Auto-Approvals',
  },
  { path: '/loans', title: 'Credit Accounts', milestone: 'M4' },
  { path: '/cba/output', title: 'Update CBA Accounts', milestone: 'M6', permission: 'Update CBA Details' },
  { path: '/cba/fix', title: 'Fix CBA Issues', milestone: 'M6', permission: 'Update CBA Details' },
  { path: '/upload-credit-cards', title: 'Upload Credit Cards', milestone: 'M4' },
  { path: '/open-accounts', title: 'Open Accounts', milestone: 'M4' },
  { path: '/write-offs', title: 'Written-off Credit Accounts', milestone: 'M4' },
  { path: '/ignored-accounts', title: 'Ignored Loan Accounts', milestone: 'M4' },
  { path: '/force-closed-accounts', title: 'Force Closed Accounts', milestone: 'M4' },
  { path: '/upload-fully-paid-or-write-offs', title: 'Upload Fully Paid / Written Off', milestone: 'M4' },
  { path: '/upload-bounced-cheques', title: 'Bounced Cheques', milestone: 'M4' },
  { path: '/branches', title: 'Branches', milestone: 'M4', permission: 'Manage Branches' },
  { path: '/branches/new', title: 'New Branch', milestone: 'M4', permission: 'Create Branches' },
  { path: '/pis', title: 'PI Stakeholder', milestone: 'M4' },
  { path: '/bs-list', title: 'Borrower Stakeholder', milestone: 'M4' },
  { path: '/cmc-list', title: 'Collateral', milestone: 'M4' },
  { path: '/ccg-list', title: 'Borrower Guarantor', milestone: 'M4' },
  { path: '/fraud', title: 'Financial Malpractice', milestone: 'M4' },
  {
    path: '/off-balance-sheet',
    title: 'Off Balance Sheet Items',
    milestone: 'M4',
    permission: 'View Off Balance Sheet Items',
  },
  { path: '/t24', title: 'Configuration', milestone: 'M5', permission: 'Sync T24' },
  { path: '/analysis', title: 'PR4 vs CBA Analysis', milestone: 'M5', permission: 'View Analysis' },
  { path: '/reports', title: 'CRB Reports', milestone: 'M6', permission: 'Download Crb Reports' },
  {
    path: '/reports/loans-without-cmc-bs-ccg',
    title: 'Loans Without CMC, CCG, BS',
    milestone: 'M6',
    permission: 'Download Crb Reports',
  },
  {
    path: '/reports/submission-analysis',
    title: 'Submission Analysis',
    milestone: 'M6',
    permission: 'Download Crb Reports',
  },
  { path: '/output-files', title: 'Output Files', milestone: 'M6' },
  {
    path: '/background-processes',
    title: 'Background Processes',
    milestone: 'M7',
    permission: 'View Analysis',
  },
  { path: '/requests', title: 'Deletion Requests', milestone: 'M7' },
  { path: '/admin/configuration', title: 'System Configuration', milestone: 'M9', layout: 'admin' },
]
