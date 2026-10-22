import type { PathRegistry } from '../security/pathRegistry'
import type { Exec } from '../ssh/connection'

/** A site served by a reverse proxy, whatever the proxy is. */
export interface ProxySite {
  hosts: string[]
  upstreams: { host: string; port: number }[]
  staticRoot?: string
}

/** One implementation per reverse proxy (Caddy, nginx, …). `available:false` means the proxy could not be read. */
export interface ProxyProvider {
  id: string
  detect(ctx: { exec: Exec; paths: PathRegistry }): Promise<{ sites: ProxySite[]; available: boolean }>
}

export function addUpstream(site: ProxySite, host: string, port: number): void {
  if (!site.upstreams.some((u) => u.host === host && u.port === port)) site.upstreams.push({ host, port })
}
