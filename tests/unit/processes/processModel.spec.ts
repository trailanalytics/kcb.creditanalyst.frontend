import { describe, expect, it } from 'vitest'
import {
  applyUpdate,
  badgeClass,
  badgeLabel,
  escapeHtml,
  isActive,
  isRetryable,
  progressBarClass,
  startedLabel,
  truncate,
  typeLabel,
} from '@/modules/processes/processModel'
import { processRoutes } from '@/modules/processes/routes'
import type { BackgroundProcess } from '@/modules/processes/types'

export const process = (id: number, extra: Partial<BackgroundProcess> = {}): BackgroundProcess => ({
  id,
  type: 'cba_generation',
  title: `CBA Report Generation (2026093${id})`,
  status: 'processing',
  progress: 40,
  progress_label: 'Processing loan accounts... (300/650) | ETA: 12s',
  error_message: null,
  has_file: false,
  result_url: null,
  started_at: '24 Oct 2026 10:00',
  created_at: '24 Oct 2026 09:59',
  completed_at: null,
  user_name: 'Jane Doe',
  ...extra,
})

describe('status helpers', () => {
  it('treats pending and processing as active', () => {
    expect(
      ['pending', 'processing', 'completed', 'failed'].map((status) =>
        isActive({ status } as BackgroundProcess),
      ),
    ).toEqual([true, true, false, false])
  })

  it('names and colours each status', () => {
    expect(['pending', 'processing', 'completed', 'failed'].map(badgeLabel)).toEqual([
      'Pending',
      'Processing',
      'Completed',
      'Failed',
    ])
    expect(badgeLabel('weird')).toBe('weird')
    expect(badgeClass('completed')).toContain('bg-success')
    expect(badgeClass('failed')).toContain('bg-danger')
    expect(badgeClass('processing')).toContain('bg-primary-1')
    expect(badgeClass('pending')).toContain('bg-slate-500')
    expect(badgeClass('weird')).toContain('bg-slate-500')
  })

  it('draws the bar green, red or moving', () => {
    expect(progressBarClass('completed')).toBe('bg-success')
    expect(progressBarClass('failed')).toBe('bg-danger')
    expect(progressBarClass('processing')).toContain('progress-striped')
    expect(progressBarClass('pending')).toContain('progress-striped')
  })
})

describe('retry', () => {
  it('is offered for failed PR4 processes only', () => {
    expect(isRetryable(process(1, { status: 'failed', type: 'pr4_import_update' }))).toBe(true)
    expect(isRetryable(process(1, { status: 'failed', type: 'pr4_import_analyse' }))).toBe(true)
    expect(isRetryable(process(1, { status: 'failed', type: 'pr4_loan_update' }))).toBe(true)
    expect(isRetryable(process(1, { status: 'failed', type: 'cba_generation' }))).toBe(false)
    expect(isRetryable(process(1, { status: 'completed', type: 'pr4_loan_update' }))).toBe(false)
    expect(isRetryable(process(1, { status: 'processing', type: 'pr4_loan_update' }))).toBe(false)
  })
})

describe('labels', () => {
  it('shows the creation time while a process has not started', () => {
    expect(startedLabel({ started_at: '24 Oct 2026 10:00', created_at: 'x' })).toBe('24 Oct 2026 10:00')
    expect(startedLabel({ started_at: null, created_at: '24 Oct 2026 09:59' })).toBe(
      '24 Oct 2026 09:59 (queued)',
    )
  })

  it('writes the type without underscores', () => {
    expect(typeLabel('cba_csv_import')).toBe('cba csv import')
    expect(typeLabel('pr4_import_update')).toBe('pr4 import update')
  })

  it('cuts long error messages at 80 characters', () => {
    expect(truncate('short')).toBe('short')
    expect(truncate('x'.repeat(80))).toBe('x'.repeat(80))
    expect(truncate('x'.repeat(81))).toBe(`${'x'.repeat(80)}…`)
    expect(truncate(null)).toBeNull()
  })

  it('escapes the characters that would be read as HTML', () => {
    expect(escapeHtml('Force Close Accounts: <img src=x onerror="a">&\'')).toBe(
      'Force Close Accounts: &lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;',
    )
  })
})

describe('applyUpdate', () => {
  it('replaces the polled fields of one process and leaves the rest', () => {
    const list = [process(1), process(2)]
    const next = applyUpdate(list, {
      id: 2,
      type: 'cba_generation',
      title: 'CBA Report Generation (20260932)',
      status: 'completed',
      progress: 100,
      progress_label: 'CBA report generated successfully.',
      has_file: true,
      result_url: null,
      error_message: null,
      completed_at: '24 Oct 2026 10:05',
    })
    expect(next[0]).toEqual(list[0])
    expect(next[1]).toMatchObject({
      status: 'completed',
      progress: 100,
      has_file: true,
      completed_at: '24 Oct 2026 10:05',
      user_name: 'Jane Doe',
      created_at: '24 Oct 2026 09:59',
    })
  })

  it('ignores a process that is not on the page', () => {
    const list = [process(1)]
    expect(applyUpdate(list, { ...process(9), completed_at: null })).toEqual(list)
  })
})

describe('routes', () => {
  it('replaces the placeholder, needs no permission and keeps the Laravel path', () => {
    expect(processRoutes).toHaveLength(1)
    expect(processRoutes[0]?.path).toBe('/background-processes')
    expect(processRoutes[0]?.meta?.permission).toBeUndefined()
    expect(processRoutes[0]?.meta?.title).toBe('Background Processes')
  })
})
