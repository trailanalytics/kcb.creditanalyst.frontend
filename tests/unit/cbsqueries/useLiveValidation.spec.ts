import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useLiveValidation } from '@/modules/cbsqueries/useLiveValidation'
import type { ValidationOutcome } from '@/modules/cbsqueries/types'

const outcome = (errors: number): ValidationOutcome => ({
  passed: errors === 0,
  errorCount: errors,
  warningCount: 0,
  findings: [],
})

function setup(validate: (b: { module: string; sql: string }) => Promise<ValidationOutcome>) {
  const sql = ref('SELECT 1')
  const module = ref('extract-loans')
  let live!: ReturnType<typeof useLiveValidation>
  const wrapper = mount(
    defineComponent({
      setup() {
        live = useLiveValidation(module, sql, { validate })
        return () => null
      },
    }),
  )
  return { sql, module, live, wrapper }
}

describe('useLiveValidation', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('waits 800 ms after the last keystroke and then posts the text with the module', async () => {
    const validate = vi.fn().mockResolvedValue(outcome(0))
    const { sql, live } = setup(validate)
    sql.value = 'SELECT 2'
    await nextTick()
    vi.advanceTimersByTime(799)
    expect(validate).not.toHaveBeenCalled()
    sql.value = 'SELECT 3'
    await nextTick()
    vi.advanceTimersByTime(799)
    expect(validate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    await vi.waitFor(() => expect(live.outcome.value).not.toBeNull())
    expect(validate).toHaveBeenCalledTimes(1)
    expect(validate).toHaveBeenCalledWith({ module: 'extract-loans', sql: 'SELECT 3' })
    expect(live.validatedSql.value).toBe('SELECT 3')
    expect(live.stale.value).toBe(false)
  })

  it('is stale while the findings belong to older text', async () => {
    const validate = vi.fn().mockResolvedValue(outcome(1))
    const { sql, live } = setup(validate)
    await live.validateNow()
    expect(live.stale.value).toBe(false)
    sql.value = 'SELECT 9'
    await nextTick()
    expect(live.stale.value).toBe(true)
  })

  it('keeps only the newest answer when an older request finishes last', async () => {
    const resolvers: ((o: ValidationOutcome) => void)[] = []
    const validate = vi.fn(() => new Promise<ValidationOutcome>((r) => resolvers.push(r)))
    const { sql, live } = setup(validate)
    void live.validateNow()
    sql.value = 'SELECT 2'
    await nextTick()
    void live.validateNow()
    resolvers[1]?.(outcome(0))
    await vi.waitFor(() => expect(live.outcome.value?.errorCount).toBe(0))
    resolvers[0]?.(outcome(7))
    await Promise.resolve()
    expect(live.outcome.value?.errorCount).toBe(0)
    expect(live.validatedSql.value).toBe('SELECT 2')
  })

  it('does not check again the text that validateNow already sent', async () => {
    const validate = vi.fn().mockResolvedValue(outcome(0))
    const { sql, live } = setup(validate)
    sql.value = 'SELECT 5'
    void live.validateNow()
    await nextTick()
    vi.advanceTimersByTime(800)
    await vi.waitFor(() => expect(live.outcome.value).not.toBeNull())
    expect(validate).toHaveBeenCalledTimes(1)
  })

  it('reports a failed check without dropping the last result, and recovers on the next one', async () => {
    const validate = vi
      .fn()
      .mockResolvedValueOnce(outcome(2))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(outcome(0))
    const { live } = setup(validate)
    await live.validateNow()
    await live.validateNow()
    expect(live.failed.value).toBe(true)
    expect(live.outcome.value?.errorCount).toBe(2)
    await live.validateNow()
    expect(live.failed.value).toBe(false)
    expect(live.outcome.value?.passed).toBe(true)
  })

  it('clears the result and does not call the server for blank text', async () => {
    const validate = vi.fn().mockResolvedValue(outcome(0))
    const { sql, live } = setup(validate)
    await live.validateNow()
    sql.value = '   '
    await live.validateNow()
    expect(validate).toHaveBeenCalledTimes(1)
    expect(live.outcome.value).toBeNull()
  })
})
