import { promises as dns } from 'node:dns'
import { connect } from 'node:tls'
import type { DomainCheck } from '../../shared/types'

export interface DomainDeps {
  resolve4(host: string): Promise<string[]>
  /** `ip` is the address already resolved and vetted: connect to it, use `host` only as the SNI name. */
  tlsProbe(host: string, ip: string): Promise<{ validTo: Date }>
}

/** Loopback, private, link-local, CGNAT, unspecified, multicast and reserved ranges are not public. */
export function isPublicIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return false
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false
  if (a === 100 && b >= 64 && b <= 127) return false
  if (a === 169 && b === 254) return false
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 168) return false
  if (a === 198 && (b === 18 || b === 19)) return false
  return true
}

/** Real network access: DNS from this machine, and a TLS handshake with the user's own domain. */
export const defaultDomainDeps: DomainDeps = {
  resolve4: (host) => dns.resolve4(host),
  tlsProbe: (host, ip) =>
    new Promise((resolve, reject) => {
      const socket = connect({ host: ip, port: 443, servername: host, timeout: 5000 }, () => {
        const cert = socket.getPeerCertificate()
        socket.end()
        resolve({ validTo: new Date(cert.valid_to) })
      })
      socket.on('timeout', () => {
        socket.destroy()
        reject(new Error('TLS handshake timed out'))
      })
      socket.on('error', reject)
    })
}

/** Skip wildcards, bare names, IPs and port-only addresses: they cannot be checked from outside. */
export function isCheckableHost(host: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host) && !/^\d+(\.\d+){3}$/.test(host)
}

export async function checkDomain(
  host: string,
  serverIp: string,
  deps: DomainDeps,
  now: Date = new Date()
): Promise<DomainCheck> {
  const ips = await deps.resolve4(host).catch(() => [] as string[])
  const matchesServer = ips.length > 0 && serverIp ? ips.includes(serverIp) : null

  // The hostname comes from the server's proxy config: only probe a public address we resolved ourselves.
  let tls: DomainCheck['tls']
  if (ips.length === 0) tls = { ok: false, error: 'DNS resolution failed' }
  else if (!ips.every(isPublicIPv4)) tls = { ok: false, error: 'resolves to a non-public address: not probed' }
  else {
    try {
      const { validTo } = await deps.tlsProbe(host, ips[0]!)
      const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / 86_400_000)
      tls = daysLeft < 0 ? { ok: false, daysLeft, error: 'certificate expired' } : { ok: true, daysLeft }
    } catch (e) {
      tls = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
  return { host, ips, matchesServer, tls }
}
