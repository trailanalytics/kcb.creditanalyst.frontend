import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { Api } from './support/api'
import { authFile } from './support/auth'
import { BASE_URL, PERSONAS, passwordOf, type Persona } from './support/env'

/**
 * Signs every seeded user in once through the real login API and keeps the sessions, so the specs start signed in
 * (the login cases themselves use the screen). Fails early and clearly when the stack or the seed is missing.
 */
export default async function globalSetup() {
  const health = await fetch(`${BASE_URL}/api/v1/me`).catch(() => null)
  if (!health) {
    throw new Error(
      `Nothing answers at ${BASE_URL}. Start the stack and the dev server first (docs/uat/README.md in the backend repo).`,
    )
  }
  for (const persona of Object.keys(PERSONAS) as Persona[]) {
    if (persona === 'disabled') continue
    const { api, status, body } = await Api.login(PERSONAS[persona], passwordOf(persona))
    if (!api) {
      throw new Error(
        `Could not sign in ${PERSONAS[persona]} (HTTP ${status} ${JSON.stringify(body)}). Did you run scripts/uat/seed.sh?`,
      )
    }
    mkdirSync(dirname(authFile(persona)), { recursive: true })
    await api.saveState(authFile(persona))
    await api.dispose()
  }
}
