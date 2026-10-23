<script setup lang="ts">
import { reactive, ref } from 'vue'
import axios from 'axios'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { swalNotification } from '@/utils/dialogs'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ email: '', password: '' })
const errors = ref<Record<string, string[]>>({})
const busy = ref(false)
const version = import.meta.env.VITE_APP_VERSION ?? '3.0'

async function submit() {
  busy.value = true
  errors.value = {}
  try {
    await auth.login(form.email, form.password)
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(target)
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 422) {
      errors.value = e.response.data.errors ?? {}
    } else if (axios.isAxiosError(e) && e.response?.data?.detail) {
      void swalNotification('error', String(e.response.data.detail))
    } else {
      void swalNotification('error', 'Login failed. Please try again.')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-4xl px-2">
    <div class="border border-slate-200 bg-white">
      <div class="grid md:grid-cols-5">
        <div class="flex items-center justify-center bg-[rgb(227,239,227)] px-8 py-8 md:col-span-2">
          <img src="/img/ug-kcb-logo.webp" alt="KCB Bank Uganda" class="w-full" />
        </div>
        <form class="px-8 py-10 text-center md:col-span-3" novalidate @submit.prevent="submit">
          <p class="mb-6 mt-3 text-xl">LOGIN</p>

          <div class="mb-3 text-left">
            <input
              v-model="form.email"
              type="text"
              name="email"
              autocomplete="email"
              autofocus
              placeholder="KCB User ID/Email"
              class="w-full rounded border px-3 py-3 focus:outline-none"
              :class="errors.email ? 'border-danger' : 'border-slate-300 focus:border-primary-1'"
            />
            <p v-for="m in errors.email" :key="m" class="mt-1 text-sm font-semibold text-danger" role="alert">
              {{ m }}
            </p>
          </div>

          <div class="mb-3 text-left">
            <input
              v-model="form.password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="Password"
              class="w-full rounded border px-3 py-3 focus:outline-none"
              :class="errors.password ? 'border-danger' : 'border-slate-300 focus:border-primary-1'"
            />
            <p
              v-for="m in errors.password"
              :key="m"
              class="mt-1 text-sm font-semibold text-danger"
              role="alert"
            >
              {{ m }}
            </p>
          </div>

          <button
            type="submit"
            :disabled="busy"
            class="mt-4 w-full rounded bg-project py-3 text-white disabled:opacity-60"
          >
            Login
          </button>
        </form>
      </div>
    </div>
    <div class="mt-4 text-center">
      <small>Credit Analyst {{ version }}</small
      ><br />
      <small class="text-[0.7rem] text-muted">A Product Of Trail Analytics Limited</small>
    </div>
  </div>
</template>
