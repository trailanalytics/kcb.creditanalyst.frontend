import { request, type APIRequestContext, type APIResponse } from '@playwright/test'
import { BASE_URL, PERSONAS, passwordOf, type Persona } from './env'
import { authFile } from './auth'

export interface Reply<T = any> {
  status: number
  ok: boolean
  body: T
  headers: Record<string, string>
  raw: APIResponse
}

/**
 * The real API, called the way the SPA calls it: through the dev server's /api proxy, with the session cookie and the CSRF
 * header. Specs use it to read state and to create their own data; the screens under test are always driven in the browser.
 */
export class Api {
  private constructor(
    readonly persona: Persona,
    private readonly ctx: APIRequestContext,
  ) {}

  static async as(persona: Persona): Promise<Api> {
    const ctx = await request.newContext({ baseURL: BASE_URL, storageState: authFile(persona) })
    return new Api(persona, ctx)
  }

  /** Sign in with a password and keep the session (used by global setup and by cases about other credentials). */
  static async login(
    email: string,
    password: string,
  ): Promise<{ api: Api | null; status: number; body: any }> {
    const ctx = await request.newContext({ baseURL: BASE_URL })
    await ctx.get('/api/v1/me') // the first request hands out the CSRF cookie
    const token = await xsrf(ctx)
    const res = await ctx.post('/api/v1/auth/login', {
      data: { email, password },
      headers: { 'X-XSRF-TOKEN': token },
    })
    const body = await res.json().catch(() => null)
    if (!res.ok()) {
      await ctx.dispose()
      return { api: null, status: res.status(), body }
    }
    const persona = (Object.entries(PERSONAS).find(([, e]) => e === email)?.[0] ?? 'officer') as Persona
    return { api: new Api(persona, ctx), status: res.status(), body }
  }

  static async signInAs(persona: Persona): Promise<Api> {
    const { api, status } = await Api.login(PERSONAS[persona], passwordOf(persona))
    if (!api) throw new Error(`could not sign in as ${persona}: HTTP ${status}`)
    return api
  }

  async saveState(path: string) {
    await this.ctx.storageState({ path })
  }

  async dispose() {
    await this.ctx.dispose()
  }

  private async send(
    method: string,
    path: string,
    options: {
      data?: unknown
      params?: Record<string, string | number>
      multipart?: Record<string, any>
    } = {},
  ): Promise<Reply> {
    const token = await xsrf(this.ctx)
    const res = await this.ctx.fetch(path, {
      method,
      data: options.data as any,
      params: options.params,
      multipart: options.multipart,
      headers: { 'X-XSRF-TOKEN': token, Accept: 'application/json' },
      maxRedirects: 0,
    })
    const headers = res.headers()
    let body: any = null
    const type = headers['content-type'] ?? ''
    if (type.includes('json')) body = await res.json().catch(() => null)
    else if (type.startsWith('text/') && !type.includes('csv')) body = await res.text()
    return { status: res.status(), ok: res.ok(), body, headers, raw: res }
  }

  get(path: string, params?: Record<string, string | number>) {
    return this.send('GET', path, { params })
  }
  post(path: string, data?: unknown) {
    return this.send('POST', path, { data })
  }
  put(path: string, data?: unknown) {
    return this.send('PUT', path, { data })
  }
  delete(path: string) {
    return this.send('DELETE', path)
  }
  upload(
    path: string,
    field: string,
    file: { name: string; mimeType: string; buffer: Buffer },
    extra: Record<string, string> = {},
  ) {
    return this.send('POST', path, { multipart: { [field]: file, ...extra } })
  }

  /** A call that must succeed: throws with the server's answer otherwise, so a broken fixture is obvious. */
  async must(reply: Promise<Reply>, what: string): Promise<Reply> {
    const r = await reply
    if (!r.ok) throw new Error(`${what} failed: HTTP ${r.status} ${JSON.stringify(r.body)}`)
    return r
  }
}

async function xsrf(ctx: APIRequestContext): Promise<string> {
  const state = await ctx.storageState()
  return (
    state.cookies
      .filter((c) => c.name === 'XSRF-TOKEN')
      .map((c) => decodeURIComponent(c.value))
      .at(-1) ?? ''
  )
}
