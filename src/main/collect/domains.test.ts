import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { checkDomain, isCheckableHost, isPublicIPv4, type DomainDeps } from './domains'

describe('isPublicIPv4', () => {
  it('rejects loopback, private, link-local, CGNAT, unspecified and multicast addresses', () => {
    for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '172.31.255.255', '169.254.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', 'nope'])
      expect(isPublicIPv4(ip)).toBe(false)
  })
  it('accepts public addresses', () => {
    for (const ip of ['8.8.8.8', '203.0.113.10', '172.32.0.1']) expect(isPublicIPv4(ip)).toBe(true)
  })
})

describe('checkDomain probing safety', () => {
  const now2 = new Date('2026-10-21T12:00:00Z')
  it('probes the resolved public ip, not the hostname, so a second lookup cannot redirect it', async () => {
    const tlsProbe = vi.fn(async () => ({ validTo: new Date(now2.getTime() + 5 * 86_400_000 + 1000) }))
    await checkDomain('a.example.com', '1.2.3.4', { resolve4: async () => ['1.2.3.4'], tlsProbe }, now2)
    expect(tlsProbe).toHaveBeenCalledWith('a.example.com', '1.2.3.4')
  })
  it('never probes a host that resolves to a private address', async () => {
    const tlsProbe = vi.fn(async () => ({ validTo: new Date() }))
    const r = await checkDomain('intranet.example.com', '1.2.3.4', { resolve4: async () => ['10.0.0.5'], tlsProbe }, now2)
    expect(tlsProbe).not.toHaveBeenCalled()
    expect(r.tls).toEqual({ ok: false, error: 'resolves to a non-public address: not probed' })
  })
  it('does not probe when the name does not resolve', async () => {
    const tlsProbe = vi.fn(async () => ({ validTo: new Date() }))
    const r = await checkDomain('gone.example.com', '1.2.3.4', { resolve4: async () => Promise.reject(new Error('ENOTFOUND')), tlsProbe }, now2)
    expect(tlsProbe).not.toHaveBeenCalled()
    expect(r.tls).toEqual({ ok: false, error: 'DNS resolution failed' })
  })
})

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
