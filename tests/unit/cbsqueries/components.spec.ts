import { describe, expect, it } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import ExpectedColumns from '@/modules/cbsqueries/components/ExpectedColumns.vue'
import FindingsTable from '@/modules/cbsqueries/components/FindingsTable.vue'
import ReviewsList from '@/modules/cbsqueries/components/ReviewsList.vue'
import SqlEditor from '@/modules/cbsqueries/components/SqlEditor.vue'
import StatusBanner from '@/modules/cbsqueries/components/StatusBanner.vue'
import { COLUMNS, finding } from './fixtures'

describe('FindingsTable', () => {
  const rows = [
    finding({
      ordinal: 1,
      foundText: 'A.CUS_ID',
      expectedAlias: 'CUS_ID',
      suggestedOffset: 15,
      message: 'Add AS CUS_ID',
      columnPosition: 1,
    }),
    finding({
      ordinal: 2,
      severity: 'WARNING',
      code: 'EXTRA_COLUMN',
      message: 'Not read',
      columnPosition: 4,
    }),
  ]

  it('shows the severity, column position, message, found text and expected alias of each finding', () => {
    const w = mount(FindingsTable, { props: { findings: rows } })
    const first = w.get('[data-testid="finding-1"]')
    expect(first.get('[data-testid="severity"]').text()).toBe('ERROR')
    expect(first.get('[data-testid="finding-column"]').text()).toBe('1')
    expect(first.get('[data-testid="finding-message"]').text()).toContain('Add AS CUS_ID')
    expect(first.get('[data-testid="finding-found"]').text()).toBe('A.CUS_ID')
    expect(first.get('[data-testid="finding-expected"]').text()).toBe('CUS_ID')
    expect(w.get('[data-testid="finding-2"] [data-testid="severity"]').text()).toBe('WARNING')
  })

  it('offers Apply suggestion only on rows with an expected alias, and emits the finding', async () => {
    const w = mount(FindingsTable, { props: { findings: rows, showApply: true, applicable: true } })
    expect(w.findAll('[data-testid="apply"]')).toHaveLength(1)
    await w.get('[data-testid="finding-1"] [data-testid="apply"]').trigger('click')
    expect(w.emitted('apply')?.[0]).toEqual([rows[0]])
  })

  it('disables Apply suggestion while the findings are older than the text', () => {
    const w = mount(FindingsTable, { props: { findings: rows, showApply: true, applicable: false } })
    expect(w.get('[data-testid="apply"]').attributes('disabled')).toBeDefined()
  })

  it('hides the apply column in a read only table and says so when there is nothing to show', () => {
    expect(
      mount(FindingsTable, { props: { findings: rows } })
        .find('[data-testid="apply"]')
        .exists(),
    ).toBe(false)
    expect(mount(FindingsTable, { props: { findings: [], empty: 'Nothing found.' } }).text()).toContain(
      'Nothing found.',
    )
  })
})

describe('ExpectedColumns', () => {
  it('ticks the columns the query produces and crosses the missing ones', () => {
    const w = mount(ExpectedColumns, {
      props: {
        columns: COLUMNS,
        findings: [finding({ code: 'MISSING_COLUMN', expectedAlias: 'CUS_NAME' })],
        bindCount: 1,
      },
    })
    expect(w.get('[data-testid="column-CUS_ID"]').attributes('data-state')).toBe('ok')
    expect(w.get('[data-testid="column-CUS_NAME"]').attributes('data-state')).toBe('missing')
    expect(w.get('[data-testid="column-CUS_ID"]').text()).toContain('required')
    expect(w.get('[data-testid="columns-summary"]').text()).toContain('2 of 3 expected columns produced')
    expect(w.get('[data-testid="columns-summary"]').text()).toContain('1 bind')
  })

  it('shows every column as not checked before a result exists', () => {
    const w = mount(ExpectedColumns, { props: { columns: COLUMNS, findings: null } })
    expect(w.findAll('[data-state="unknown"]')).toHaveLength(3)
    expect(w.get('[data-testid="columns-summary"]').text()).toContain('Not checked yet')
  })
})

describe('SqlEditor', () => {
  it('numbers every line, including empty ones', () => {
    const w = mount(SqlEditor, { props: { modelValue: 'SELECT 1\n\nFROM DUAL' } })
    const numbers = w
      .get('[data-testid="line-numbers"]')
      .findAll('div')
      .map((d) => d.text())
    expect(numbers).toEqual(['1', '2', '3'])
  })

  it('emits the typed text and renumbers', async () => {
    const w = mount(SqlEditor, {
      props: { modelValue: 'a', 'onUpdate:modelValue': (v: string) => w.setProps({ modelValue: v }) },
    })
    await w.get('textarea').setValue('a\nb\nc\nd')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['a\nb\nc\nd'])
    expect(w.get('[data-testid="line-numbers"]').findAll('div')).toHaveLength(4)
  })

  it('is read only when asked and never wraps lines', () => {
    const w = mount(SqlEditor, { props: { modelValue: 'x', readonly: true } })
    expect(w.get('textarea').attributes('readonly')).toBeDefined()
    expect(w.get('textarea').attributes('wrap')).toBe('off')
  })
})

describe('StatusBanner', () => {
  it('shows the status and what happens next', () => {
    const w = mount(StatusBanner, { props: { status: 'VALIDATION_FAILED' } })
    expect(w.text()).toContain('Validation failed')
    expect(w.text()).toContain('submit it again')
  })
})

describe('ReviewsList', () => {
  const reviews = [
    {
      id: 1,
      outcome: 'CHANGES_RECOMMENDED' as const,
      comment: 'Please fix',
      reviewer: 'Amy',
      createdAt: '2026-10-22T09:00:00Z',
      recommendations: [
        { id: 1, text: 'Alias it', appliedInVersionId: 7 },
        { id: 2, text: 'Drop it', appliedInVersionId: null },
      ],
    },
    {
      id: 2,
      outcome: 'APPROVED' as const,
      comment: null,
      reviewer: 'Amy',
      createdAt: null,
      recommendations: [],
    },
  ]

  it('shows the recommendations with the version that applied them, or that they are still open', () => {
    const w = mount(ReviewsList, { props: { reviews }, global: { stubs: { RouterLink: RouterLinkStub } } })
    const recs = w.findAll('[data-testid="recommendation"]')
    expect(recs[0]?.text()).toContain('applied in version #7')
    expect(recs[1]?.find('[data-testid="open-rec"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="review-outcome"]').map((o) => o.text())).toEqual([
      'Changes recommended',
      'Approved',
    ])
    expect(w.findComponent(RouterLinkStub).props('to')).toBe('/cbs-queries/versions/7')
  })

  it('says there is no review yet', () => {
    expect(mount(ReviewsList, { props: { reviews: [] } }).text()).toContain('No review yet')
  })
})
