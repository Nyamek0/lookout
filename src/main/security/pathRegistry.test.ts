import { describe, expect, it } from 'vitest'
import { PathRegistry } from './pathRegistry'

describe('PathRegistry', () => {
  it('only allows paths that were registered', () => {
    const r = new PathRegistry()
    expect(r.isAllowed('/etc/caddy/Caddyfile')).toBe(false)
    r.register('/etc/caddy/Caddyfile')
    expect(r.isAllowed('/etc/caddy/Caddyfile')).toBe(true)
  })
  it('refuses traversal, relative paths and NUL even if registered', () => {
    const r = new PathRegistry()
    for (const p of ['/etc/../etc/shadow', 'relative/path', '/opt/app\0/x']) {
      r.register(p)
      expect(r.isAllowed(p)).toBe(false)
    }
  })
})
