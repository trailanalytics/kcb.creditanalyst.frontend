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
  {
    path: '/auto-approval-reviews',
    title: 'Auto-Approval Reviews',
    milestone: 'M9',
    permission: 'Resolve Auto-Approvals',
  },
  { path: '/cba/output', title: 'Update CBA Accounts', milestone: 'M6', permission: 'Update CBA Details' },
  { path: '/cba/fix', title: 'Fix CBA Issues', milestone: 'M6', permission: 'Update CBA Details' },
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
]
