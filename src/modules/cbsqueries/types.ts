/** Version life cycle (cbs_query_versions.status). */
export type VersionStatus =
  'DRAFT' | 'VALIDATION_FAILED' | 'VALIDATED' | 'CHANGES_RECOMMENDED' | 'APPROVED' | 'ACTIVE' | 'SUPERSEDED'

export type Severity = 'ERROR' | 'WARNING' | 'INFO'

export type ReviewOutcome = 'APPROVED' | 'CHANGES_RECOMMENDED'

/** GET /core-systems */
export interface CoreSystem {
  code: string
  name: string
  /** The one the bank runs (`creditanalyst.cbs.core-system`). */
  configured: boolean
}

/** One expected column of a module. */
export interface ModuleColumn {
  ordinal: number
  name: string
  required: boolean
  description: string | null
}

export interface ActiveVersionRef {
  id: number
  versionNo: number
  activatedAt: string | null
  activatedBy: string | null
}

/** What a module holds for one core system: the active version and how many samples exist. */
export interface ModuleSystemState {
  coreSystem: string
  activeVersion: ActiveVersionRef | null
  sampleCount: number
}

/** GET /modules, one entry. */
export interface ModuleSummary {
  code: string
  name: string
  description: string | null
  bindCount: number
  bindDescription: string | null
  columns: ModuleColumn[]
  systems: ModuleSystemState[]
}

/** The module of a version with its expected columns. */
export interface VersionModule {
  code: string
  name: string
  bindCount: number | null
  bindDescription: string | null
  columns: ModuleColumn[]
}

/** A line of GET /versions or GET /samples. People are shown by name. */
export interface VersionSummary {
  id: number
  coreSystem: string
  module: string
  moduleName: string | null
  versionNo: number
  status: VersionStatus
  isSample: boolean
  note: string | null
  parentVersionId: number | null
  createdBy: string | null
  createdAt: string | null
  submittedBy: string | null
  submittedAt: string | null
  activatedBy: string | null
  activatedAt: string | null
}

export interface Finding {
  ordinal: number
  severity: Severity
  code: string
  columnPosition: number | null
  foundText: string | null
  expectedAlias: string | null
  /** Where `AS <expectedAlias>` goes in the SQL that was validated; null for a wrong alias. */
  suggestedOffset: number | null
  message: string
}

/** POST /validate and the findings of a stored result. */
export interface ValidationOutcome {
  passed: boolean
  errorCount: number
  warningCount: number
  findings: Finding[]
}

/** `latestValidation` of a version. */
export interface StoredValidation extends ValidationOutcome {
  runAt: string | null
}

export interface Recommendation {
  id: number
  text: string
  appliedInVersionId: number | null
}

export interface Review {
  id: number | null
  outcome: ReviewOutcome
  comment: string | null
  reviewer: string | null
  createdAt: string | null
  recommendations: Recommendation[]
}

export interface AuditEvent {
  id: number | null
  versionId: number | null
  versionNo: number | null
  coreSystem: string | null
  module: string | null
  actor: string | null
  event: string
  detail: string | null
  createdAt: string | null
}

/** GET /versions/{id}. The flags are the caller's own: the server decides, the page only follows. */
export interface VersionDetail extends VersionSummary {
  sql: string
  moduleInfo: VersionModule
  latestValidation: StoredValidation | null
  reviews: Review[]
  events: AuditEvent[]
  canEdit: boolean
  canSubmit: boolean
  canReview: boolean
  canActivate: boolean
}

export interface CreateDraftBody {
  coreSystem: string
  module: string
  fromVersionId?: number
  sql?: string
  note?: string
}

export interface ReviewBody {
  outcome: ReviewOutcome
  comment: string
  recommendations: string[]
}
