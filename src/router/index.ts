import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { PLACEHOLDERS } from './placeholders'

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
      {
        path: 'configuration',
        name: 'admin-configuration',
        component: () => import('@/pages/PlaceholderPage.vue'),
        meta: { title: 'System Configuration', milestone: 'M9' },
      },
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
