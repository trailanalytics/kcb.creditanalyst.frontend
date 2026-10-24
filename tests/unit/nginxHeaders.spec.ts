import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// ${API_UPSTREAM} is filled in at container start; its braces would end a location block early here
const template = readFileSync('nginx/default.conf.template', 'utf8').replaceAll('${API_UPSTREAM}', 'UPSTREAM')
const headers = readFileSync('nginx/snippets/security-headers.conf', 'utf8')
const proxy = readFileSync('nginx/snippets/proxy-api.conf', 'utf8')

/** The `location ... { ... }` blocks of the template (they hold no nested braces). */
function locations(): { head: string; body: string }[] {
  return [...template.matchAll(/location\s+([^{]+)\{([^}]*)\}/g)].map((m) => ({
    head: (m[1] ?? '').trim(),
    body: m[2] ?? '',
  }))
}

describe('nginx security headers', () => {
  it('sets the headers every static response needs', () => {
    for (const name of [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
      'Permissions-Policy',
      'Strict-Transport-Security',
    ]) {
      expect(headers).toContain(`add_header ${name}`)
    }
    expect(headers).toContain("frame-ancestors 'none'")
    expect(headers).toContain("object-src 'none'")
  })

  it("allows scripts from this origin only, never 'unsafe-inline' or 'unsafe-eval' for them", () => {
    const csp = /add_header Content-Security-Policy "([^"]+)"/.exec(headers)?.[1] ?? ''
    const script = csp.split(';').find((d) => d.trim().startsWith('script-src')) ?? ''
    expect(script.trim()).toBe("script-src 'self'")
    expect(csp).not.toContain('unsafe-eval')
  })

  it('repeats the headers in every location that serves files (nginx drops outer add_header once a location sets its own)', () => {
    const served = locations().filter((l) => !l.body.includes('proxy_pass') && !l.body.includes('return '))
    expect(served.map((l) => l.head)).toEqual(['/assets/', '/'])
    for (const l of served) {
      expect(l.body, `location ${l.head}`).toContain('include /etc/nginx/snippets/security-headers.conf')
    }
  })

  it('sends HSTS only when the request came in over TLS', () => {
    expect(template).toMatch(/map \$scheme \$hsts_header \{\s*default ""/)
    expect(headers).toContain('Strict-Transport-Security $hsts_header')
    expect(proxy).toContain('Strict-Transport-Security $hsts_header')
  })

  it('sets, not appends, the client address it passes to the API', () => {
    expect(proxy).toContain('proxy_set_header X-Forwarded-For $remote_addr;')
    expect(proxy).not.toContain('$proxy_add_x_forwarded_for')
  })

  it('limits request bodies: 21m for the API, 100m only for the two big upload paths', () => {
    expect(template).toMatch(/client_max_body_size 21m;/)
    const big = locations().filter((l) => l.body.includes('client_max_body_size 100m'))
    expect(big.map((l) => l.head)).toEqual(['~ ^/api/v1/(analysis/pr4|output-files/)'])
  })

  it('proxies the API through the shared snippet', () => {
    for (const l of locations().filter((x) => x.body.includes('proxy_pass'))) {
      expect(l.body).toContain('include /etc/nginx/snippets/proxy-api.conf')
    }
  })
})
