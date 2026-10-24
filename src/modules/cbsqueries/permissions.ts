/** Permission names of the CBS Queries group (ids 67 and 68 in PermissionCatalog). */
export const MANAGE_CBS_QUERIES = 'Manage CBS Queries'
export const REVIEW_CBS_QUERIES = 'Review CBS Queries'

/** Viewing needs either one; the router reads this list through `meta.anyPermission`. */
export const VIEW_CBS_QUERIES = [MANAGE_CBS_QUERIES, REVIEW_CBS_QUERIES]
