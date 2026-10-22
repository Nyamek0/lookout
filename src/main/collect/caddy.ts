import { buildCommand } from '../security/commands'
import { addUpstream, type ProxyProvider, type ProxySite } from './proxy'

const CADDYFILE_PATH = '/etc/caddy/Caddyfile'

type Dict = Record<string, unknown>
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)

function splitDial(dial: string): { host: string; port: number } | null {
  const m = /^(?:https?:\/\/)?([^\s:/]+):(\d+)$/.exec(dial.trim())
  return m ? { host: m[1]!, port: Number(m[2]) } : null
}

function walk(node: unknown, site: ProxySite): void {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, site))
  if (!isDict(node)) return
  if (node['handler'] === 'reverse_proxy' && Array.isArray(node['upstreams'])) {
    for (const u of node['upstreams']) {
      const d = isDict(u) && typeof u['dial'] === 'string' ? splitDial(u['dial']) : null
      if (d) addUpstream(site, d.host, d.port)
    }
  }
  if ((node['handler'] === 'vars' || node['handler'] === 'file_server') && typeof node['root'] === 'string') {
    site.staticRoot = node['root']
  }
  walk(node['handle'], site)
  walk(node['routes'], site)
}

/** Sites from `GET /config/` of the Caddy admin API. */
export function parseCaddyAdminConfig(json: unknown): ProxySite[] {
  const servers = isDict(json) && isDict(json['apps']) && isDict(json['apps']['http']) ? json['apps']['http']['servers'] : null
  if (!isDict(servers)) return []
  const sites: ProxySite[] = []
  for (const server of Object.values(servers)) {
    const routes = isDict(server) && Array.isArray(server['routes']) ? server['routes'] : []
    for (const route of routes) {
      if (!isDict(route)) continue
      const hosts = (Array.isArray(route['match']) ? route['match'] : []).flatMap((m) =>
        isDict(m) && Array.isArray(m['host']) ? (m['host'] as string[]) : []
      )
      if (hosts.length === 0) continue
      const site: ProxySite = { hosts, upstreams: [] }
      walk(route['handle'], site)
      sites.push(site)
    }
  }
  return sites
}

const stripScheme = (h: string): string => h.replace(/^https?:\/\//, '').replace(/:\d+$/, '')

/** Fallback: top-level site blocks of a Caddyfile; `reverse_proxy` and `root *` are found at any depth. */
export function parseCaddyfile(text: string): ProxySite[] {
  const sites: ProxySite[] = []
  let depth = 0
  let current: ProxySite | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const opens = line.endsWith('{')

    if (depth === 0 && opens) {
      const header = line.slice(0, -1).trim()
      current = null
      if (header && !header.startsWith('(')) {
        const hosts = header.split(/[\s,]+/).filter(Boolean).map(stripScheme).filter(Boolean)
        if (hosts.length > 0) {
          current = { hosts, upstreams: [] }
          sites.push(current)
        }
      }
      depth = 1
      continue
    }
    if (line === '}') {
      depth = Math.max(0, depth - 1)
      if (depth === 0) current = null
      continue
    }
    if (current) {
      const words = line.replace(/\{$/, '').trim().split(/\s+/)
      if (words[0] === 'reverse_proxy') {
        for (const w of words.slice(1)) {
          const d = splitDial(w)
          if (d) addUpstream(current, d.host, d.port)
        }
      } else if (words[0] === 'root' && words.length >= 2) {
        current.staticRoot = words[words.length - 1]
      }
    }
    if (opens) depth++
  }
  return sites
}

export const caddyProvider: ProxyProvider = {
  id: 'caddy',
  async detect({ exec, paths }) {
    try {
      const admin = await exec.exec(buildCommand('caddyAdminConfig'))
      if (admin.code === 0 && admin.stdout.trim()) {
        return { available: true, sites: parseCaddyAdminConfig(JSON.parse(admin.stdout)) }
      }
    } catch {
      // admin API closed or not JSON: try the Caddyfile
    }
    try {
      paths.register(CADDYFILE_PATH)
      const file = await exec.exec(buildCommand('readFile', { path: CADDYFILE_PATH }, paths))
      if (file.code === 0 && file.stdout.trim()) return { available: true, sites: parseCaddyfile(file.stdout) }
    } catch {
      // unreadable
    }
    return { available: false, sites: [] }
  }
}
