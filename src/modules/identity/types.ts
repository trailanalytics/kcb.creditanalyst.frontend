/** Shapes of the identity API (backend: identity module). */
export interface UserRow {
  id: number
  firstname: string | null
  lastname: string | null
  email: string
  status: string
  lastLogin: string | null
  authentication: string
  createdby: string | null
  branchId: number | null
  createdAt: string | null
  role: string | null
  /** A deletion request is waiting for this user (Laravel's is_deleted). */
  pendingDeletion: boolean
}

export interface UserDetail {
  user: UserRow
  permissionIds: number[]
}

export interface UserForm {
  firstName: string
  lastName: string
  email: string
  authentication: 'ad' | 'credit_analyst'
  password: string
  role: string
  status: 'enabled' | 'disabled'
  branchId: number | null
  permissionIds: number[]
}

export interface PermissionItem {
  id: number
  name: string
  isDefault: boolean
}

export interface PermissionGroup {
  group: string
  permissions: PermissionItem[]
}

export interface Lookups {
  roles: string[]
  permissionGroups: PermissionGroup[]
}

export interface BranchOption {
  id: number
  code: string | null
  value: string
}

export interface LogUser {
  id: number
  firstname: string | null
  lastname: string | null
}

export interface LogRow {
  id: number
  title: string
  activity: string | null
  tableName: string | null
  recordId: string | null
  oldRecord: string | null
  newRecord: string | null
  email: string | null
  createdAt: string | null
  user: LogUser | null
}

export interface DeletedCount {
  name: string
  count: number
}
