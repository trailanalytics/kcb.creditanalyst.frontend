import type { RouteRecordRaw } from 'vue-router'

/**
 * Participating institution, branches and PI stakeholders. The paths are Laravel's, typo included (`/proflie/new/pis`);
 * `/pis/new` reaches the same page. Added to the app layout's children by the router.
 */
export const institutionRoutes: RouteRecordRaw[] = [
  {
    path: '/institution',
    name: 'institution',
    component: () => import('./InstitutionPage.vue'),
    meta: { title: 'Participating Institution', permission: 'Update PI Details' },
  },
  {
    path: '/branches',
    name: 'branches',
    component: () => import('./BranchesPage.vue'),
    meta: { title: 'Branches', permission: 'Manage Branches' },
  },
  {
    path: '/branches/new',
    name: 'branch-new',
    component: () => import('./BranchFormPage.vue'),
    meta: { title: 'New Branch', permission: 'Create Branches' },
  },
  {
    path: '/branches/edit/:id(\\d+)',
    name: 'branch-edit',
    component: () => import('./BranchFormPage.vue'),
    props: true,
    meta: { title: 'Edit Branch', permission: 'Update Branches' },
  },
  {
    path: '/pis',
    name: 'pis',
    component: () => import('./PisPage.vue'),
    meta: { title: 'PI Stakeholder', permission: 'Manage PIS' },
  },
  {
    path: '/proflie/new/pis',
    name: 'pis-new',
    component: () => import('./PisFormPage.vue'),
    meta: { title: 'New PIS Record', permission: 'Manage PIS' },
  },
  {
    path: '/pis/new',
    name: 'pis-new-alias',
    component: () => import('./PisFormPage.vue'),
    meta: { title: 'New PIS Record', permission: 'Manage PIS' },
  },
  {
    path: '/edit/pis/:id(\\d+)',
    name: 'pis-edit',
    component: () => import('./PisFormPage.vue'),
    props: true,
    meta: { title: 'Update PIS Record', permission: 'Update PIS' },
  },
]
