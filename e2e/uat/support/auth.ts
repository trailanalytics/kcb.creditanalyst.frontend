import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Persona } from './env'

/** Where global setup keeps each persona's signed-in session (git-ignored). */
export function authFile(persona: Persona): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '.auth', `${persona}.json`)
}
