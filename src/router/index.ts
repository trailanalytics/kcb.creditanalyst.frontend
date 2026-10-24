import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { PLACEHOLDERS } from './placeholders'
import { loansRoutes } from '@/modules/loans/routes'
import { securitiesRoutes } from '@/modules/securities/routes'
import { chequeRoutes } from '@/modules/cheque/routes'
import { fraudRoutes } from '@/modules/fraud/routes'
import { institutionRoutes } from '@/modules/institution/routes'
import { adminConfigRoutes, t24Routes } from '@/modules/t24/routes'
import { analysisRoutes } from '@/modules/analysis/routes'
import { cbaFixRoutes } from '@/modules/cbafix/routes'
import { processRoutes } from '@/modules/processes/routes'
import { reportRoutes } from '@/modules/reports/routes'
import { requestRoutes } from '@/modules/requests/routes'

declare module 'vue-router' {
  interface RouteMeta {
    /** No sign-in needed. */
    public?: boolean
    /** Permission name that must be granted (user_permissions). */
    permission?: string
    /** Only for the admin and CRB officer roles (Laravel's `admin` middleware). */
    admin?: boolean
    title?: string
    milestone?: string
  }
}

const placeholderRoutes: RouteRecordRaw[] = PLACEHOLDERS.map((p) => ({
  path: p.path,
  name: `placeholder:${p.path}`,
  component: () => import('@/pages/PlaceholderPage.vue'),
  meta: { title: p.title, milestone: p.milestone, permission: p.permission },
}))

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/BlankLayout.vue'),
    children: [
      {
        path: '',
        name: 'login',
        component: () => import('@/pages/LoginPage.vue'),
        meta: { public: true, title: 'Login' },
      },
    ],
  },
  {
    path: '/errors/:code',
    name: 'error',
    component: () => import('@/pages/errors/ErrorPage.vue'),
    meta: { public: true, title: 'Error' },
  },
  { path: '/', redirect: { name: 'home' } },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: 'home',
        name: 'home',
        component: () => import('@/modules/dashboard/DashboardPage.vue'),
        meta: { title: 'Dashboard' },
      },
      {
        path: 'profiles',
        name: 'profiles',
        component: () => import('@/modules/customer/ProfilesPage.vue'),
        meta: { title: 'Profiles' },
      },
      {
        path: 'find-in-t24',
        name: 'find-in-t24',
        component: () => import('@/modules/customer/ImportFromT24Page.vue'),
        meta: { title: 'Import from T24' },
      },
      {
        path: 'borrowers/:id(\\d+)',
        name: 'profile',
        component: () => import('@/modules/customer/ProfileShowPage.vue'),
        props: true,
        meta: { title: 'Profile', permission: 'View Profiles' },
      },
      {
        path: 'borrowers/edit/:id(\\d+)',
        name: 'profile-edit',
        component: () => import('@/modules/customer/ProfileEditPage.vue'),
        props: true,
        meta: { title: 'Edit Profile', permission: 'Update Profiles' },
      },
      {
        path: 'applications',
        name: 'applications',
        component: () => import('@/modules/application/ApplicationsPage.vue'),
        meta: { title: 'Credit Applications', permission: 'View Credit Applications' },
      },
      {
        path: 'applications/report',
        name: 'applications-report',
        component: () => import('@/modules/application/ApplicationsReportPage.vue'),
        meta: { title: 'Applications Report', permission: 'Applications Report' },
      },
      {
        path: 'applications/bulk-approve',
        name: 'applications-bulk',
        component: () => import('@/modules/application/BulkApprovalPage.vue'),
        meta: { title: 'Bulk Approval', permission: 'Approve/Reject Applications' },
      },
      {
        path: 'applications/create/:clientNumber',
        name: 'application-new',
        component: () => import('@/modules/application/ApplicationFormPage.vue'),
        props: true,
        meta: { title: 'New Credit Application', permission: 'Create Applications' },
      },
      {
        path: 'applications/joint/create/:args',
        name: 'application-joint',
        component: () => import('@/modules/application/JointApplicationPage.vue'),
        props: true,
        meta: { title: 'Joint Application', permission: 'Create Applications' },
      },
      {
        path: 'applications/edit/:id(\\d+)',
        name: 'application-edit',
        component: () => import('@/modules/application/ApplicationFormPage.vue'),
        props: true,
        meta: { title: 'Edit Credit Application', permission: 'Edit Applications' },
      },
      {
        path: 'applications/show/:id(\\d+)',
        name: 'application',
        component: () => import('@/modules/application/ApplicationShowPage.vue'),
        props: true,
        meta: { title: 'Credit Application', permission: 'View Credit Applications' },
      },
      {
        path: 'applications/change-status/:id(\\d+)',
        name: 'application-status',
        component: () => import('@/modules/application/ChangeStatusPage.vue'),
        props: true,
        meta: { title: 'Change Status', permission: 'Approve/Reject Applications' },
      },
      ...loansRoutes,
      ...securitiesRoutes,
      ...chequeRoutes,
      ...fraudRoutes,
      ...institutionRoutes,
      ...t24Routes,
      ...analysisRoutes,
      ...cbaFixRoutes,
      ...processRoutes,
      ...reportRoutes,
      ...requestRoutes,
      ...placeholderRoutes.filter((r) => r.path !== '/admin/configuration'),
    ],
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      {
        path: '',
        name: 'admin',
        component: () => import('@/modules/dashboard/AdminDashboardPage.vue'),
        meta: { title: 'Admin Dashboard' },
      },
      ...adminConfigRoutes,
    ],
  },
  {
    path: '/',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { admin: true },
    children: [
      {
        path: 'users',
        name: 'users',
        component: () => import('@/modules/identity/UsersPage.vue'),
        meta: { title: 'Users', permission: 'Manage Users' },
      },
      {
        path: 'users/new',
        name: 'user-new',
        component: () => import('@/modules/identity/UserFormPage.vue'),
        meta: { title: 'New User', permission: 'Create, Update and Delete Users' },
      },
      {
        path: 'users/:id/edit',
        name: 'user-edit',
        component: () => import('@/modules/identity/UserFormPage.vue'),
        props: true,
        meta: { title: 'Edit User', permission: 'Create, Update and Delete Users' },
      },
      {
        path: 'logs',
        name: 'logs',
        component: () => import('@/modules/identity/LogsPage.vue'),
        meta: { title: 'Logs and Statistics', permission: 'View Statistics' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', redirect: { name: 'error', params: { code: '404' } } },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.loaded) await auth.load()

  if (to.meta.public) {
    // a signed-in user does not need the login page (Laravel's guest middleware)
    return to.name === 'login' && auth.isAuthenticated ? { name: 'home' } : true
  }
  if (!auth.isAuthenticated)
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  if (to.matched.some((r) => r.meta.admin) && !auth.canSeeAdmin) return { name: 'home' }
  if (to.meta.permission && !auth.has(to.meta.permission)) return { name: 'error', params: { code: '403' } }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} | Credit Analyst` : 'Credit Analyst'
})

export default router
