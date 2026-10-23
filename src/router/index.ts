import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    permission?: string
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('@/layouts/BlankLayout.vue'),
      children: [
        { path: '', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
      ],
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [{ path: '', name: 'home', component: () => import('@/pages/HomePage.vue') }],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/NotFoundPage.vue'),
      meta: { public: true },
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const auth = useAuthStore()
  if (!auth.isAuthenticated) await auth.load()
  if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.permission && !auth.has(to.meta.permission)) return { name: 'home' }
  return true
})

export default router
