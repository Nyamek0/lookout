import { describe, expect, it } from 'vitest'
import { fixture } from '../../../test/support/fixture'
import type { Exec } from '../ssh/connection'
import { PathRegistry } from '../security/pathRegistry'
import { caddyProvider, parseCaddyAdminConfig, parseCaddyfile } from './caddy'

const expected = [
  {
    hosts: ['shop.example.com', 'www.shop.example.com', 'event.shop.example.com'],
    upstreams: [{ host: '127.0.0.1', port: 3018 }]
  },
  {
    hosts: ['api.shop.example.com'],
    upstreams: [
      { host: '127.0.0.1', port: 8000 },
      { host: '127.0.0.1', port: 1080 }
    ]
  },
  { hosts: ['static.example.org', 'www.static.example.org'], upstreams: [], staticRoot: '/var/www/site' }
]

describe('caddy parsers', () => {
  it('reads sites from the admin API json', () => {
    expect(parseCaddyAdminConfig(JSON.parse(fixture('caddy-admin.json')))).toEqual(expected)
  })

  it('reads the same sites from a Caddyfile', () => {
    expect(parseCaddyfile(fixture('Caddyfile.sample'))).toEqual(expected)
  })

  it('never throws on empty or odd input', () => {
    expect(parseCaddyAdminConfig({})).toEqual([])
    expect(parseCaddyAdminConfig(null)).toEqual([])
    expect(parseCaddyfile('')).toEqual([])
    expect(parseCaddyfile('{\n\tadmin off\n}\n(snippet) {\n\tencode gzip\n}')).toEqual([])
  })
})

function fakeExec(handler: (argv: string[]) => { stdout: string; code: number }): Exec {
  return {
    exec: async (argv) => ({ stderr: '', ...handler(argv) }),
    stream: () => ({ stop() {} })
  }
}

describe('caddyProvider', () => {
  it('prefers the admin API', async () => {
    const exec = fakeExec((argv) =>
      argv[0] === 'curl' ? { stdout: fixture('caddy-admin.json'), code: 0 } : { stdout: '', code: 1 }
    )
    const r = await caddyProvider.detect({ exec, paths: new PathRegistry() })
    expect(r.available).toBe(true)
    expect(r.sites).toEqual(expected)
  })

  it('falls back to the Caddyfile at its known location', async () => {
    const exec = fakeExec((argv) =>
      argv[0] === 'cat' ? { stdout: fixture('Caddyfile.sample'), code: 0 } : { stdout: '', code: 7 }
    )
    const r = await caddyProvider.detect({ exec, paths: new PathRegistry() })
    expect(r.available).toBe(true)
    expect(r.sites).toEqual(expected)
  })

  it('reports unavailable without throwing when neither source works', async () => {
    const exec = fakeExec(() => ({ stdout: '', code: 1 }))
    expect(await caddyProvider.detect({ exec, paths: new PathRegistry() })).toEqual({
      available: false,
      sites: []
    })
  })
})
