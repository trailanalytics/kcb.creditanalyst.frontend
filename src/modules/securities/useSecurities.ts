import { reactive } from 'vue'
import { securitiesApi } from './api'
import { contextReference } from './collateralModel'
import type { CollateralRow, Overview, PartyKind, PartyStart, SecurityContext } from './types'

/**
 * The state of the security panels of one credit application or loan account, shared by the header buttons
 * (SecurityActions) and the panels with their modals (SecurityPanels): the loaded overview and which dialog is open.
 * Both components ask for the same session by the application's reference or the loan's contract code.
 */
export interface SecuritySession {
  context: SecurityContext
  overview: Overview | null
  loading: boolean
  error: unknown
  collateralDialog: { open: boolean; item: CollateralRow | null }
  partyDialog: { open: boolean; kind: PartyKind; start: PartyStart; version: number }
  customerPicker: { open: boolean; role: PartyKind }
  stakeholderPicker: { open: boolean }
  reload(): Promise<void>
  openCollateral(item?: CollateralRow): void
  openParty(kind: PartyKind, start: PartyStart): void
  pickCustomer(role: PartyKind): void
  pickStakeholder(): Promise<void>
}

const sessions = new Map<string, SecuritySession>()

export const sessionKey = (context: SecurityContext) => `${context.type}:${contextReference(context)}`

export function useSecurities(context: SecurityContext): SecuritySession {
  const key = sessionKey(context)
  const existing = sessions.get(key)
  if (existing) return existing

  const session = reactive<SecuritySession>({
    context,
    overview: null,
    loading: false,
    error: null,
    collateralDialog: { open: false, item: null },
    partyDialog: { open: false, kind: 'guarantor', start: { mode: 'new', classification: '0' }, version: 0 },
    customerPicker: { open: false, role: 'guarantor' },
    stakeholderPicker: { open: false },
    async reload() {
      session.loading = true
      try {
        session.overview = await securitiesApi.overview(contextReference(context))
        session.error = null
      } catch (e) {
        session.error = e
      } finally {
        session.loading = false
      }
    },
    openCollateral(item) {
      session.collateralDialog.item = item ?? null
      session.collateralDialog.open = true
    },
    openParty(kind, start) {
      session.partyDialog.kind = kind
      session.partyDialog.start = start
      // a new start rebuilds the form; closing and reopening after an error does not
      session.partyDialog.version += 1
      session.partyDialog.open = true
    },
    pickCustomer(role) {
      session.customerPicker.role = role
      session.customerPicker.open = true
    },
    async pickStakeholder() {
      if (!session.overview) await session.reload()
      session.stakeholderPicker.open = true
    },
  })
  sessions.set(key, session)
  return session
}

/** For tests: forget every session. */
export const resetSecuritySessions = () => sessions.clear()
