import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import {
  fileLabel,
  FIX_TABS,
  showBarText,
  uploadFailureHtml,
  UPLOAD_FAILED,
  withinLimit,
} from '@/modules/cbafix/fixModel'

const failure = (status: number, data: unknown) =>
  new AxiosError('failed', 'ERR_BAD_REQUEST', undefined, undefined, { status, data } as never)

describe('upload failures', () => {
  it('lists the validation messages one per line', () => {
    const e = failure(422, {
      detail: 'The given data was invalid.',
      errors: { file: ['The file must be a file of type: csv, txt, xlsx, xls.', 'The other.'] },
    })
    expect(uploadFailureHtml(e)).toBe('The file must be a file of type: csv, txt, xlsx, xls.<br>The other.')
  })

  it('shows the server text for a conflict and escapes it', () => {
    expect(uploadFailureHtml(failure(409, { detail: 'A CBA generation, cleanup or fix is running.' }))).toBe(
      'A CBA generation, cleanup or fix is running.',
    )
    expect(uploadFailureHtml(failure(409, { detail: '<img src=x onerror=alert(1)>' }))).not.toContain('<img')
  })

  it('falls back to the generic line', () => {
    expect(uploadFailureHtml(new Error('network'))).toBe(UPLOAD_FAILED)
    expect(uploadFailureHtml(failure(500, {}))).toBe(UPLOAD_FAILED)
  })
})

describe('the file box', () => {
  it('has the two limits of the server', () => {
    expect(FIX_TABS.delete.maxKb).toBe(102_400)
    expect(FIX_TABS.customer.maxKb).toBe(51_200)
    expect(FIX_TABS.delete.endpoint).toBe('delete-records')
    expect(FIX_TABS.customer.endpoint).toBe('fix-customer-details')
  })

  it('checks the size against the limit in kilobytes', () => {
    const f = (bytes: number) => ({ size: bytes }) as File
    expect(withinLimit(f(51_200 * 1024), 51_200)).toBe(true)
    expect(withinLimit(f(51_200 * 1024 + 1), 51_200)).toBe(false)
  })

  it('shows the name once a file is chosen and the percentage in the bar only when it is wide enough', () => {
    expect(fileLabel(null)).toBe('Choose file (.csv or .xlsx)')
    expect(fileLabel(new File(['x'], 'codes.csv'))).toBe('codes.csv')
    expect(showBarText(15)).toBe(false)
    expect(showBarText(16)).toBe(true)
  })
})
