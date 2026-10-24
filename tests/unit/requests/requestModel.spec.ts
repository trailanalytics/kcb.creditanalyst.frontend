import { describe, expect, it } from 'vitest'
import { actionsFor, recordText, requestedOn } from '@/modules/requests/requestModel'

describe('requestedOn', () => {
  it('formats as D, MMM YYYY', () => {
    expect(requestedOn('2026-04-10T12:00:00')).toBe('10, Apr 2026')
    expect(requestedOn('2026-04-10T12:00:00Z')).toBe('10, Apr 2026')
  })
  it('is empty for nothing or rubbish', () => {
    expect(requestedOn(null)).toBe('')
    expect(requestedOn('not a date')).toBe('')
  })
})

describe('actionsFor', () => {
  const pending = { request_status: 0 as const, requested_by: 7 }
  it("offers what the user may do on somebody else's pending request", () => {
    expect(actionsFor(pending, { id: 1, canApprove: true, canCancel: true })).toEqual({
      approve: true,
      cancel: true,
    })
    expect(actionsFor(pending, { id: 1, canApprove: true, canCancel: false })).toEqual({
      approve: true,
      cancel: false,
    })
    expect(actionsFor(pending, { id: 1, canApprove: false, canCancel: false })).toEqual({
      approve: false,
      cancel: false,
    })
  })
  it('offers nothing on the own request, however many permissions there are', () => {
    expect(actionsFor(pending, { id: 7, canApprove: true, canCancel: true })).toEqual({
      approve: false,
      cancel: false,
    })
  })
  it('offers nothing once the request is decided', () => {
    expect(
      actionsFor({ request_status: 1, requested_by: 7 }, { id: 1, canApprove: true, canCancel: true }),
    ).toEqual({
      approve: false,
      cancel: false,
    })
  })
})

describe('recordText', () => {
  it('uses the label, else the table and id', () => {
    expect(recordText({ record_label: 'KCB/CMC/1 - Ann', table_name: 'collaterals', record_id: 4 })).toBe(
      'KCB/CMC/1 - Ann',
    )
    expect(recordText({ record_label: null, table_name: 'collaterals', record_id: 4 })).toBe('collaterals #4')
  })
})
