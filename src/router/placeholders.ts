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
]
