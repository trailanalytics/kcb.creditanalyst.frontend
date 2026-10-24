import type {
  ActiveVersionRef,
  AuditEvent,
  CoreSystem,
  Finding,
  ModuleColumn,
  ModuleSummary,
  ModuleSystemState,
  Recommendation,
  Review,
  ReviewOutcome,
  Severity,
  StoredValidation,
  ValidationOutcome,
  VersionDetail,
  VersionModule,
  VersionStatus,
  VersionSummary,
} from './types'

/**
 * The API section of docs/cbs-query-validator.md fixes the field names but not every nesting. These readers accept the
 * documented shape and the obvious variants (a bare array or `{data}`, a person as a name or as `{name}`, a code or
 * `{code}`), so the pages work against either and fail soft on a missing field.
 */
type Raw = Record<string, unknown>

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): string | null =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const bool = (v: unknown): boolean => v === true
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** A list that arrives bare or wrapped in `{data}` (paged lists wrap it, plain ones may not). */
export function listOf(body: unknown): unknown[] {
  if (Array.isArray(body)) return body
  if (isObject(body) && Array.isArray(body.data)) return body.data
  return []
}

/** One object that arrives bare or wrapped in `{data}`. */
export function unwrap(body: unknown): Raw {
  if (isObject(body) && isObject(body.data) && !('id' in body)) return body.data
  return isObject(body) ? body : {}
}

/** A person (`createdBy`, `reviewer`, `actor`): a name, or an object with a name. */
export function personName(v: unknown): string | null {
  if (isObject(v)) return str(v.name) ?? str(v.fullName) ?? str(v.email) ?? null
  return str(v)
}

/** A core system or module: the code, or an object holding it. */
export function codeOf(v: unknown): string | null {
  if (isObject(v)) return str(v.code)
  return str(v)
}

const STATUSES: VersionStatus[] = [
  'DRAFT',
  'VALIDATION_FAILED',
  'VALIDATED',
  'CHANGES_RECOMMENDED',
  'APPROVED',
  'ACTIVE',
  'SUPERSEDED',
]
const asStatus = (v: unknown): VersionStatus => {
  const s = String(v ?? '').toUpperCase() as VersionStatus
  return STATUSES.includes(s) ? s : 'DRAFT'
}
const asSeverity = (v: unknown): Severity => {
  const s = String(v ?? '').toUpperCase()
  return s === 'ERROR' || s === 'WARNING' ? s : 'INFO'
}
const asOutcome = (v: unknown): ReviewOutcome =>
  String(v ?? '').toUpperCase() === 'APPROVED' ? 'APPROVED' : 'CHANGES_RECOMMENDED'

export function toCoreSystem(raw: unknown): CoreSystem {
  const r = isObject(raw) ? raw : {}
  return { code: str(r.code) ?? '', name: str(r.name) ?? str(r.code) ?? '', configured: bool(r.configured) }
}

export function toColumn(raw: unknown, index: number): ModuleColumn {
  const r = isObject(raw) ? raw : {}
  return {
    ordinal: num(r.ordinal) ?? index + 1,
    name: str(r.name) ?? '',
    required: bool(r.required),
    description: str(r.description),
  }
}

const columnsOf = (raw: unknown): ModuleColumn[] =>
  arr(raw)
    .map(toColumn)
    .sort((a, b) => a.ordinal - b.ordinal)

function toActiveRef(raw: unknown): ActiveVersionRef | null {
  if (!isObject(raw)) return null
  const id = num(raw.id)
  if (id === null) return null
  return {
    id,
    versionNo: num(raw.versionNo) ?? 0,
    activatedAt: str(raw.activatedAt),
    activatedBy: personName(raw.activatedBy),
  }
}

/** Per core system: `[{coreSystem, activeVersion, sampleCount}]` or the same keyed by the code. */
function systemStates(raw: Raw): ModuleSystemState[] {
  const source = raw.coreSystems ?? raw.systems ?? raw.perCoreSystem
  const entries: [string | null, unknown][] = Array.isArray(source)
    ? source.map((s) => [isObject(s) ? (codeOf(s.coreSystem) ?? str(s.code)) : null, s])
    : isObject(source)
      ? Object.entries(source)
      : []
  return entries
    .filter(([code]) => code !== null)
    .map(([code, s]) => {
      const r = isObject(s) ? s : {}
      return {
        coreSystem: code as string,
        activeVersion: toActiveRef(r.activeVersion),
        sampleCount: num(r.sampleCount) ?? 0,
      }
    })
}

export function toModuleSummary(raw: unknown): ModuleSummary {
  const r = isObject(raw) ? raw : {}
  return {
    code: str(r.code) ?? '',
    name: str(r.name) ?? str(r.code) ?? '',
    description: str(r.description),
    bindCount: num(r.bindCount) ?? 0,
    bindDescription: str(r.bindDescription),
    columns: columnsOf(r.columns),
    systems: systemStates(r),
  }
}

export function toVersionSummary(raw: unknown): VersionSummary {
  const r = isObject(raw) ? raw : {}
  return {
    id: num(r.id) ?? 0,
    coreSystem: codeOf(r.coreSystem) ?? '',
    module: codeOf(r.module) ?? '',
    moduleName: isObject(r.module) ? str(r.module.name) : str(r.moduleName),
    versionNo: num(r.versionNo) ?? 0,
    status: asStatus(r.status),
    isSample: bool(r.isSample),
    note: str(r.note),
    parentVersionId: num(r.parentVersionId),
    createdBy: personName(r.createdBy),
    createdAt: str(r.createdAt),
    submittedBy: personName(r.submittedBy),
    submittedAt: str(r.submittedAt),
    activatedBy: personName(r.activatedBy),
    activatedAt: str(r.activatedAt),
  }
}

export function toFinding(raw: unknown, index: number): Finding {
  const r = isObject(raw) ? raw : {}
  return {
    ordinal: num(r.ordinal) ?? index + 1,
    severity: asSeverity(r.severity),
    code: str(r.code) ?? '',
    columnPosition: num(r.columnPosition),
    foundText: str(r.foundText),
    expectedAlias: str(r.expectedAlias),
    suggestedOffset: num(r.suggestedOffset),
    message: str(r.message) ?? '',
  }
}

export function toOutcome(raw: unknown): ValidationOutcome {
  const r = unwrap(raw)
  const findings = arr(r.findings).map(toFinding)
  const count = (s: Severity) => findings.filter((f) => f.severity === s).length
  return {
    passed: typeof r.passed === 'boolean' ? r.passed : count('ERROR') === 0,
    errorCount: num(r.errorCount) ?? count('ERROR'),
    warningCount: num(r.warningCount) ?? count('WARNING'),
    findings,
  }
}

function toStored(raw: unknown): StoredValidation | null {
  if (!isObject(raw)) return null
  return { ...toOutcome(raw), runAt: str(raw.runAt) }
}

function toRecommendation(raw: unknown, index: number): Recommendation {
  if (typeof raw === 'string') return { id: index, text: raw, appliedInVersionId: null }
  const r = isObject(raw) ? raw : {}
  return {
    id: num(r.id) ?? index,
    text: str(r.text) ?? '',
    appliedInVersionId: num(r.appliedInVersionId),
  }
}

function toReview(raw: unknown, index: number): Review {
  const r = isObject(raw) ? raw : {}
  return {
    id: num(r.id) ?? index,
    outcome: asOutcome(r.outcome),
    comment: str(r.comment),
    reviewer: personName(r.reviewer),
    createdAt: str(r.createdAt),
    recommendations: arr(r.recommendations).map(toRecommendation),
  }
}

export function toEvent(raw: unknown): AuditEvent {
  const r = isObject(raw) ? raw : {}
  const version = isObject(r.version) ? r.version : null
  return {
    id: num(r.id),
    versionId: num(r.versionId) ?? (version ? num(version.id) : null),
    versionNo: num(r.versionNo) ?? (version ? num(version.versionNo) : null),
    coreSystem: codeOf(r.coreSystem) ?? (version ? codeOf(version.coreSystem) : null),
    module: codeOf(r.module) ?? (version ? codeOf(version.module) : null),
    actor: personName(r.actor),
    event: str(r.event) ?? '',
    detail: str(r.detail),
    createdAt: str(r.createdAt),
  }
}

function toVersionModule(raw: unknown): VersionModule {
  const r = isObject(raw) ? raw : {}
  return {
    code: str(r.code) ?? '',
    name: str(r.name) ?? str(r.code) ?? '',
    bindCount: num(r.bindCount),
    bindDescription: str(r.bindDescription),
    columns: columnsOf(r.columns),
  }
}

export function toVersionDetail(body: unknown): VersionDetail {
  const r = unwrap(body)
  const summary = toVersionSummary(r)
  const module = toVersionModule(isObject(r.module) ? r.module : { code: summary.module, columns: r.columns })
  return {
    ...summary,
    sql: str(r.sql) ?? str(r.sqlText) ?? '',
    moduleInfo: module,
    latestValidation: toStored(r.latestValidation),
    reviews: arr(r.reviews).map(toReview),
    events: arr(r.events).map(toEvent),
    canEdit: bool(r.canEdit),
    canSubmit: bool(r.canSubmit),
    canReview: bool(r.canReview),
    canActivate: bool(r.canActivate),
  }
}
