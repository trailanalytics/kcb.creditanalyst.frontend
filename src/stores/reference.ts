import { defineStore } from 'pinia'
import { ref } from 'vue'
import { http } from '@/api/http'

/** A row of one of the CRB appendix lookups (`GET /reference/{name}`). */
export interface RefItem {
  code: string
  value: string
}

/** A bank branch: users and loan accounts point at `id`, CRB files and profiles use `code`. */
export interface BranchRef {
  id: number
  code: string | null
  value: string
}

/**
 * The appendix lookups behind the form selects (Laravel's AppendixHelpers). Each is fetched once per session and shared by
 * every form that needs it.
 */
export const useReferenceStore = defineStore('reference', () => {
  const lists = ref<Record<string, RefItem[]>>({})
  const branchList = ref<BranchRef[]>([])
  const pending = new Map<string, Promise<void>>()

  function once(key: string, load: () => Promise<void>): Promise<void> {
    let p = pending.get(key)
    if (!p) {
      p = load().catch((e) => {
        pending.delete(key)
        throw e
      })
      pending.set(key, p)
    }
    return p
  }

  /** Items of one lookup (empty until loaded; call `load` to await it). */
  const items = (name: string): RefItem[] => lists.value[name] ?? []

  function load(...names: string[]): Promise<void[]> {
    return Promise.all(
      names.map((name) =>
        name === 'branches'
          ? once(name, async () => {
              branchList.value = (await http.get<BranchRef[]>('/reference/branches')).data
            })
          : once(name, async () => {
              const { data } = await http.get<RefItem[]>(`/reference/${name}`)
              lists.value = { ...lists.value, [name]: data }
            }),
      ),
    )
  }

  /** The label of a code in a lookup, else the code itself. */
  const label = (name: string, code: string | null | undefined): string => {
    if (code === null || code === undefined || code === '') return ''
    return items(name).find((i) => i.code === String(code))?.value ?? String(code)
  }

  const branchName = (code: string | null | undefined): string =>
    branchList.value.find((b) => b.code === code)?.value ?? code ?? ''

  return { items, branches: branchList, load, label, branchName }
})
