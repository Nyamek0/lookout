import { promises as dns } from 'node:dns'
import { connect } from 'node:tls'
import type { DomainCheck } from '../../shared/types'

export interface DomainDeps {
  resolve4(host: string): Promise<string[]>
  tlsProbe(host: string): Promise<{ validTo: Date }>
}

/** Real network access: DNS from this machine, and a TLS handshake with the user's own domain. */
export const defaultDomainDeps: DomainDeps = {
  resolve4: (host) => dns.resolve4(host),
  tlsProbe: (host) =>
    new Promise((resolve, reject) => {
      const socket = connect({ host, port: 443, servername: host, timeout: 5000 }, () => {
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
  const matchesServer = ips.length > 0 ? ips.includes(serverIp) : null

  let tls: DomainCheck['tls']
  try {
    const { validTo } = await deps.tlsProbe(host)
    const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / 86_400_000)
    tls = daysLeft < 0 ? { ok: false, daysLeft, error: 'certificate expired' } : { ok: true, daysLeft }
  } catch (e) {
    tls = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
  return { host, ips, matchesServer, tls }
}
