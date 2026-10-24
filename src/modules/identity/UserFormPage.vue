<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import axios from 'axios'
import { messageOf, problemOf } from '@/api/http'
import { swalNotification, toast } from '@/utils/dialogs'
import PermissionBatch from './PermissionBatch.vue'
import { usersApi } from './api'
import type { BranchOption, Lookups, UserForm } from './types'

/** New and edit user (resources/views/admin/users/new|edit.blade.php). Edit when an `id` route param is present. */
const props = defineProps<{ id?: string }>()
const router = useRouter()
const editing = computed(() => props.id !== undefined)

const lookups = ref<Lookups>({ roles: [], permissionGroups: [] })
const branches = ref<BranchOption[]>([])
const errors = ref<Record<string, string[]>>({})
const busy = ref(false)
const ready = ref(false)

const form = reactive<UserForm>({
  firstName: '',
  lastName: '',
  email: '',
  authentication: 'ad',
  password: '',
  role: 'crb',
  status: 'enabled',
  branchId: null,
  permissionIds: [],
})

onMounted(async () => {
  try {
    const [l, b] = await Promise.all([usersApi.lookups(), usersApi.branches()])
    lookups.value = l
    branches.value = b
    if (props.id) {
      const { user, permissionIds } = await usersApi.get(props.id)
      Object.assign(form, {
        firstName: user.firstname ?? '',
        lastName: user.lastname ?? '',
        email: user.email,
        authentication: user.authentication === 'credit_analyst' ? 'credit_analyst' : 'ad',
        status: user.status === 'disabled' ? 'disabled' : 'enabled',
        role: user.role ?? 'crb',
        branchId: user.branchId,
        permissionIds,
      })
    } else {
      // new users start with the default permissions ticked
      form.permissionIds = l.permissionGroups.flatMap((g) =>
        g.permissions.filter((p) => p.isDefault).map((p) => p.id),
      )
    }
    ready.value = true
  } catch (e) {
    await swalNotification('error', messageOf(e, 'The user could not be loaded.'))
    await router.replace({ name: 'users' })
  }
})

const fieldErrors = (name: string) => errors.value[name] ?? []

async function submit() {
  busy.value = true
  errors.value = {}
  // the Admin group is not offered to the crb role, so it is not submitted
  const adminIds = new Set(
    lookups.value.permissionGroups
      .filter((g) => g.group === 'Admin')
      .flatMap((g) => g.permissions.map((p) => p.id)),
  )
  const payload: UserForm = {
    ...form,
    permissionIds:
      form.role === 'crb' ? form.permissionIds.filter((id) => !adminIds.has(id)) : form.permissionIds,
  }
  try {
    if (props.id) await usersApi.update(props.id, payload)
    else await usersApi.create(payload)
    toast.success(editing.value ? 'Updated Successfully' : 'User Created Successfully')
    await router.push({ name: 'users' })
  } catch (e) {
    const problem = problemOf(e)
    if (axios.isAxiosError(e) && e.response?.status === 422 && problem?.errors) {
      errors.value = problem.errors
    } else if (axios.isAxiosError(e) && e.response?.status === 401) {
      await router.replace({ name: 'login' })
    } else if (!(axios.isAxiosError(e) && (e.response?.status ?? 0) >= 500)) {
      // an unexpected server error already got its dialog with the reference from the global handler
      await swalNotification('error', messageOf(e))
    }
  } finally {
    busy.value = false
  }
}

const input =
  'w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-1 focus:outline-none'
</script>

<template>
  <section v-if="ready" class="max-w-5xl">
    <h1 class="mb-4 text-xl font-semibold text-project">{{ editing ? 'Edit User' : 'New User' }}</h1>

    <form class="space-y-6" novalidate @submit.prevent="submit">
      <div class="grid gap-4 rounded border border-slate-200 bg-white p-5 md:grid-cols-2">
        <label class="block text-sm">
          First name
          <input v-model="form.firstName" :class="input" type="text" autocomplete="off" />
          <span v-for="m in fieldErrors('firstName')" :key="m" class="text-xs font-semibold text-danger">{{
            m
          }}</span>
        </label>
        <label class="block text-sm">
          Last name
          <input v-model="form.lastName" :class="input" type="text" autocomplete="off" />
          <span v-for="m in fieldErrors('lastName')" :key="m" class="text-xs font-semibold text-danger">{{
            m
          }}</span>
        </label>
        <label class="block text-sm">
          Email
          <input v-model="form.email" :class="input" type="email" autocomplete="off" />
          <span v-for="m in fieldErrors('email')" :key="m" class="text-xs font-semibold text-danger">{{
            m
          }}</span>
        </label>
        <label class="block text-sm">
          Authentication
          <select v-model="form.authentication" :class="input">
            <option value="ad">Active Directory</option>
            <option value="credit_analyst">Credit Analyst (password)</option>
          </select>
          <span
            v-for="m in fieldErrors('authentication')"
            :key="m"
            class="text-xs font-semibold text-danger"
            >{{ m }}</span
          >
        </label>
        <label v-if="form.authentication === 'credit_analyst'" class="block text-sm">
          Password
          <input
            v-model="form.password"
            :class="input"
            type="password"
            autocomplete="new-password"
            :placeholder="editing ? 'Leave blank to keep the current password' : ''"
          />
          <span v-for="m in fieldErrors('password')" :key="m" class="text-xs font-semibold text-danger">{{
            m
          }}</span>
        </label>
        <label class="block text-sm">
          Role
          <select v-model="form.role" :class="input">
            <option v-for="r in lookups.roles" :key="r" :value="r">{{ r }}</option>
          </select>
          <span v-for="m in fieldErrors('role')" :key="m" class="text-xs font-semibold text-danger">{{
            m
          }}</span>
        </label>
        <label class="block text-sm">
          Status
          <select v-model="form.status" :class="input">
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
        <label class="block text-sm">
          Branch
          <select v-model="form.branchId" :class="input">
            <option :value="null">No branch</option>
            <option v-for="b in branches" :key="b.id" :value="b.id">{{ b.value }}</option>
          </select>
        </label>
      </div>

      <div>
        <h2 class="mb-2 font-semibold text-project">Permissions</h2>
        <PermissionBatch v-model="form.permissionIds" :groups="lookups.permissionGroups" :role="form.role" />
        <span v-for="m in fieldErrors('permissionIds')" :key="m" class="text-xs font-semibold text-danger">{{
          m
        }}</span>
      </div>

      <div class="flex gap-3">
        <button
          type="submit"
          :disabled="busy"
          class="rounded bg-project px-5 py-2 text-white disabled:opacity-60"
        >
          {{ editing ? 'Update User' : 'Create User' }}
        </button>
        <RouterLink :to="{ name: 'users' }" class="rounded border border-slate-300 px-5 py-2 text-slate-600"
          >Cancel</RouterLink
        >
      </div>
    </form>
  </section>
</template>
