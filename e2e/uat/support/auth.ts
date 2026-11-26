import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Persona } from './env'

/** Where global setup keeps each persona's signed-in session (git-ignored). */
export function authFile(persona: Persona): string {
  // UAT_AUTH_DIR keeps the sessions of two runs against two stacks apart (the guide capture beside a UAT run)
  const dir = process.env.UAT_AUTH_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '.auth')
  return join(dir, `${persona}.json`)
}
