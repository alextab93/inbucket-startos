import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('client security policy', () => {
  it('blocks active and embedded content in the application document', () => {
    const html = readFileSync(
      join(process.cwd(), 'frontend/index.html'),
      'utf8',
    )
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const policy = doc
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content')

    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("script-src 'self'")
    expect(policy).not.toContain("'unsafe-inline'")
    expect(policy).not.toContain("'unsafe-eval'")
  })
})
