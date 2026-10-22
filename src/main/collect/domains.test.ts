import { describe, expect, it } from 'vitest'
import { checkDomain, isCheckableHost, type DomainDeps } from './domains'

const now = new Date('2026-10-21T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 86_400_000 + 1000)
const deps = (over: Partial<DomainDeps> = {}): DomainDeps => ({
  resolve4: async () => ['1.2.3.4'],
  tlsProbe: async () => ({ validTo: days(20) }),
  ...over
})

describe('checkDomain', () => {
  it('matches the server ip and reports days left on the certificate', async () => {
    expect(await checkDomain('a.example.com', '1.2.3.4', deps(), now)).toEqual({
      host: 'a.example.com',
      ips: ['1.2.3.4'],
      matchesServer: true,
      tls: { ok: true, daysLeft: 20 }
    })
  })

  it('flags a dns record that points elsewhere', async () => {
    const r = await checkDomain('a.example.com', '9.9.9.9', deps(), now)
    expect(r.matchesServer).toBe(false)
  })

  it('has an unknown match when resolution fails', async () => {
    const r = await checkDomain(
      'a.example.com',
      '1.2.3.4',
      deps({ resolve4: async () => Promise.reject(new Error('ENOTFOUND')) }),
      now
    )
    expect(r).toMatchObject({ ips: [], matchesServer: null })
  })

  it('reports tls errors and expired certificates', async () => {
    const bad = await checkDomain(
      'a.example.com',
      '1.2.3.4',
      deps({ tlsProbe: async () => Promise.reject(new Error('self-signed')) }),
      now
    )
    expect(bad.tls).toEqual({ ok: false, error: 'self-signed' })
    const expired = await checkDomain('a.example.com', '1.2.3.4', deps({ tlsProbe: async () => ({ validTo: days(-3) }) }), now)
    expect(expired.tls?.ok).toBe(false)
  })
})

describe('isCheckableHost', () => {
  it('accepts public hostnames only', () => {
    expect(isCheckableHost('api.example.com')).toBe(true)
    for (const h of ['localhost', '*.example.com', '10.0.0.1', ':80', '']) expect(isCheckableHost(h)).toBe(false)
  })
})
