import type { RouteRecordRaw } from 'vue-router'
import { MANAGE_CBS_QUERIES, REVIEW_CBS_QUERIES, VIEW_CBS_QUERIES } from './permissions'

/**
 * CBS Query Configuration (M10): the queries the extractors read, their versions, the validator and the review. Viewing needs
 * either permission (`anyPermission`); the editor needs Manage CBS Queries and the review page Review CBS Queries. The server
 * enforces the same rules and the DBA role, so a route only decides what the app offers.
 */
export const cbsQueryRoutes: RouteRecordRaw[] = [
  {
    path: '/cbs-queries',
    name: 'cbs-queries',
    component: () => import('./pages/OverviewPage.vue'),
    meta: { title: 'CBS Query Configuration', anyPermission: VIEW_CBS_QUERIES },
  },
  {
    path: '/cbs-queries/samples',
    name: 'cbs-samples',
    component: () => import('./pages/SamplesPage.vue'),
    meta: { title: 'CBS Query Samples', anyPermission: VIEW_CBS_QUERIES },
  },
  {
    path: '/cbs-queries/events',
    name: 'cbs-events',
    component: () => import('./pages/EventsPage.vue'),
    meta: { title: 'CBS Query Events', anyPermission: VIEW_CBS_QUERIES },
  },
  {
    path: '/cbs-queries/versions/:id(\\d+)',
    name: 'cbs-version',
    component: () => import('./pages/VersionPage.vue'),
    props: true,
    meta: { title: 'CBS Query Version', anyPermission: VIEW_CBS_QUERIES },
  },
  {
    path: '/cbs-queries/versions/:id(\\d+)/edit',
    name: 'cbs-edit',
    component: () => import('./pages/EditorPage.vue'),
    props: true,
    meta: { title: 'Edit CBS Query', permission: MANAGE_CBS_QUERIES },
  },
  {
    path: '/cbs-queries/versions/:id(\\d+)/review',
    name: 'cbs-review',
    component: () => import('./pages/ReviewPage.vue'),
    props: true,
    meta: { title: 'Review CBS Query', permission: REVIEW_CBS_QUERIES },
  },
]
