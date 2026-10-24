import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { cbsApi } from './api'
import type { ValidationOutcome } from './types'

export const LIVE_VALIDATION_DELAY_MS = 800

/**
 * The editor's live check: 800 ms after the SQL stops changing it posts it to /validate (nothing is stored). Only the newest
 * request counts, so a slow answer for older text never replaces a newer one. `stale` is true while the findings belong to
 * text that has since changed, which is when "Apply suggestion" must not be offered (the offsets would be wrong).
 */
export function useLiveValidation(
  module: Ref<string>,
  sql: Ref<string>,
  api: Pick<typeof cbsApi, 'validate'> = cbsApi,
  delayMs = LIVE_VALIDATION_DELAY_MS,
) {
  const outcome = ref<ValidationOutcome | null>(null)
  const validatedSql = ref<string | null>(null)
  const checking = ref(false)
  const failed = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  /** The text last sent, so the debounce does not send again what "Apply suggestion" already checked. */
  let requested: string | null = null

  async function validateNow() {
    clearTimeout(timer)
    if (!module.value || !sql.value.trim()) {
      generation += 1
      requested = null
      outcome.value = null
      validatedSql.value = null
      checking.value = false
      failed.value = false
      return
    }
    const mine = ++generation
    const text = sql.value
    requested = text
    checking.value = true
    try {
      const result = await api.validate({ module: module.value, sql: text })
      if (mine !== generation) return
      outcome.value = result
      validatedSql.value = text
      failed.value = false
    } catch {
      if (mine !== generation) return
      requested = null
      failed.value = true
    } finally {
      if (mine === generation) checking.value = false
    }
  }

  watch(sql, () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (requested !== sql.value) void validateNow()
    }, delayMs)
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    generation += 1
  })

  const stale = computed(() => outcome.value !== null && validatedSql.value !== sql.value)
  return { outcome, validatedSql, checking, failed, stale, validateNow }
}
