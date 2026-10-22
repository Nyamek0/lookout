import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KnownHosts } from './hostKeys'

describe('KnownHosts', () => {
  it('forgets a pinned key for good, even across restarts', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'lookout-kh-')), 'known_hosts.json')
    const a = new KnownHosts(file)
    a.set('h:22', 'SHA256:old')
    a.set('other:22', 'SHA256:keep')
    a.delete('h:22')
    expect(a.get('h:22')).toBeUndefined()
    const b = new KnownHosts(file)
    expect(b.get('h:22')).toBeUndefined()
    expect(b.get('other:22')).toBe('SHA256:keep')
  })
  it('ignores forgetting something it never knew', () => {
    expect(() => new KnownHosts().delete('nope:22')).not.toThrow()
  })
})
