import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  it('writes atomically: no temporary file is left behind', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lookout-kh-'))
    const file = join(dir, 'known_hosts.json')
    new KnownHosts(file).set('h:22', 'SHA256:a')
    expect(readdirSync(dir)).toEqual(['known_hosts.json'])
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ 'h:22': 'SHA256:a' })
  })

  it('fails closed on a corrupt file: it is reported, kept as is, and nothing overwrites it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lookout-kh-'))
    const file = join(dir, 'known_hosts.json')
    writeFileSync(file, '{broken')
    const k = new KnownHosts(file)
    expect(k.corrupt).toContain(file)
    expect(() => k.set('h:22', 'SHA256:a')).toThrow(/could not be read/i)
    expect(() => k.delete('h:22')).toThrow(/could not be read/i)
    expect(readFileSync(file, 'utf8')).toBe('{broken')
  })

  it('ignores forgetting something it never knew', () => {
    expect(() => new KnownHosts().delete('nope:22')).not.toThrow()
  })
})
