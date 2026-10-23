import { crbToIso } from './dates'
import type { CollateralRow, SecurityContext } from './types'

/** The collateral form (partial add_collateral.blade.php): money as numbers, dates as yyyy-MM-dd. */
export interface CollateralForm {
  CollateralType: string
  CollateralCurrency: string
  CollateralForcedSaleValue: number | null
  CollateralOpenMarketValue: number | null
  valuationDate: string
  expiryDate: string
  InstrumentofClaim: string
  CollateralDescription: string
}

export const MSG_FORCED_SALE = 'Please provide Collateral Forced Sale Value and try again'
export const MSG_OPEN_MARKET = 'Please provide Collateral Open Market Value and try again'

export const emptyCollateral = (): CollateralForm => ({
  CollateralType: '',
  CollateralCurrency: '',
  CollateralForcedSaleValue: null,
  CollateralOpenMarketValue: null,
  valuationDate: '',
  expiryDate: '',
  InstrumentofClaim: '',
  CollateralDescription: '',
})

export function collateralFrom(c: CollateralRow): CollateralForm {
  const money = (v: string | null) => (v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))
  return {
    CollateralType: c.CollateralType ?? '',
    CollateralCurrency: c.CollateralCurrency ?? '',
    CollateralForcedSaleValue: money(c.CollateralForcedSaleValue),
    CollateralOpenMarketValue: money(c.CollateralOpenMarketValue),
    valuationDate: crbToIso(c.ValuationDate),
    expiryDate: crbToIso(c.CollateralExpiryDate),
    InstrumentofClaim: c.InstrumentofClaim ?? '',
    CollateralDescription: c.CollateralDescription ?? '',
  }
}

/** The client check before saving: both values must be above zero. Null when the form can be sent. */
export function checkCollateral(f: CollateralForm): string | null {
  if (!f.CollateralForcedSaleValue) return MSG_FORCED_SALE
  if (!f.CollateralOpenMarketValue) return MSG_OPEN_MARKET
  return null
}

/** The reference of the application or the contract code of the loan, under the field name the API expects. */
export function contextFields(context: SecurityContext | undefined): Record<string, string> {
  if (!context) return {}
  return context.type === 'application'
    ? { referenceNumber: context.referenceNumber }
    : { contractCode: context.contractCode }
}

export const contextReference = (context: SecurityContext): string =>
  context.type === 'application' ? context.referenceNumber : context.contractCode

export function collateralPayload(f: CollateralForm, context?: SecurityContext): Record<string, unknown> {
  return {
    ...contextFields(context),
    CollateralType: f.CollateralType,
    CollateralCurrency: f.CollateralCurrency,
    CollateralForcedSaleValue: String(f.CollateralForcedSaleValue ?? ''),
    CollateralOpenMarketValue: String(f.CollateralOpenMarketValue ?? ''),
    valuationDate: f.valuationDate,
    expiryDate: f.expiryDate,
    InstrumentofClaim: f.InstrumentofClaim,
    CollateralDescription: f.CollateralDescription,
  }
}
