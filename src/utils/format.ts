import dayjs from 'dayjs'

/** Ports of the Vue 2 filters in resources/js/mixins/helper.js. */

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0'
  const n = Number(value)
  if (Number.isNaN(n)) return '0'
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

const fmt = (value: unknown, pattern: string): string => {
  if (!value) return ''
  const d = dayjs(String(value))
  return d.isValid() ? d.format(pattern) : ''
}

export const formatDate = (v: unknown) => fmt(v, 'DD/MM/YYYY')
export const crbDate = (v: unknown) => fmt(v, 'YYMMDD')
export const readableDate = (v: unknown) => fmt(v, 'DD/MMM/YYYY')
export const dateInputFormat = (v: unknown) => fmt(v, 'YYYY-MM-DD')
export const getDay = (v: unknown) => fmt(v, 'DD')
export const getMonth = (v: unknown) => fmt(v, 'MM')
export const getYear = (v: unknown) => fmt(v, 'YYYY')

/** numberWithCommas from mixins/collection.js (keeps decimals as typed). */
export function numberWithCommas(x: number | string | null | undefined): string {
  if (!x && x !== 0) return ''
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
