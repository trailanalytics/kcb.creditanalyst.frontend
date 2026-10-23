/** `yyyyMMdd` (how the CRB columns are stored) as `yyyy-MM-dd` for date inputs; anything else gives an empty string. */
export const crbToIso = (v: string | null | undefined): string =>
  v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : ''
