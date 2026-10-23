import type { RouteRecordRaw } from 'vue-router'

/** Bounced cheques and the two upload pages. Laravel paths; the fully paid upload is reached from the CBA menu with `?cba=1`. */
export const chequeRoutes: RouteRecordRaw[] = [
  {
    path: '/bc-list',
    name: 'bc-list',
    component: () => import('./BouncedChequesPage.vue'),
    meta: { title: 'Bounced Cheques', permission: 'View Bounced Cheques' },
  },
  {
    path: '/upload-bounced-cheques',
    name: 'upload-bounced-cheques',
    component: () => import('./UploadChequesPage.vue'),
    meta: { title: 'Upload Bounced Cheques', permission: 'Upload Bounced Cheques' },
  },
  {
    path: '/upload-fully-paid-or-write-offs',
    name: 'upload-fully-paid-or-write-offs',
    component: () => import('./UploadChequesPage.vue'),
    props: { fullyPaid: true },
    meta: { title: 'Upload Fully Paid / Written Off', permission: 'Upload Bounced Cheques' },
  },
]
