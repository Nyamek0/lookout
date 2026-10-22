import { buildCommand } from '../security/commands'
import { addUpstream, type ProxyProvider, type ProxySite } from './proxy'

const NGINX_CONF = '/etc/nginx/nginx.conf'

type Token = { t: 'word' | '{' | '}' | ';'; v: string }
interface Node {
  name: string
  args: string[]
  children: Node[] | null
}

/** nginx syntax: words, `;`, braces, `#` comments and quoted strings (which may contain `;` and `{`). */
function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    if (/\s/.test(ch)) i++
    else if (ch === '#') while (i < text.length && text[i] !== '\n') i++
    else if (ch === '{' || ch === '}' || ch === ';') {
      tokens.push({ t: ch, v: ch })
      i++
    } else if (ch === '"' || ch === "'") {
      let value = ''
      i++
      while (i < text.length && text[i] !== ch) {
        if (text[i] === '\\') i++
        value += text[i] ?? ''
        i++
      }
      i++
      tokens.push({ t: 'word', v: value })
    } else {
      let value = ''
      while (i < text.length && !/[\s{};]/.test(text[i]!)) value += text[i++]
      tokens.push({ t: 'word', v: value })
    }
  }
  return tokens
}

function parse(tokens: Token[]): Node[] {
  let i = 0
  const block = (): Node[] => {
    const out: Node[] = []
    while (i < tokens.length) {
      const tok = tokens[i]!
      if (tok.t === '}') {
        i++
        return out
      }
      if (tok.t !== 'word') {
        i++
        continue
      }
      const words: string[] = []
      while (i < tokens.length && tokens[i]!.t === 'word') words.push(tokens[i++]!.v)
      const end = tokens[i]
      const [name = '', ...args] = words
      if (end?.t === '{') {
        i++
        out.push({ name, args, children: block() })
      } else if (end?.t === ';') {
        i++
        out.push({ name, args, children: null })
      }
    }
    return out
  }
  return block()
}

const find = (nodes: Node[], name: string): Node[] => nodes.filter((n) => n.name === name)

function walk(nodes: Node[] | null, visit: (n: Node) => void): void {
  for (const n of nodes ?? []) {
    visit(n)
    walk(n.children, visit)
  }
}

function hostPort(authority: string, defaultPort: number): { host: string; port: number } | null {
  if (authority.startsWith('unix:') || authority.includes('$')) return null
  const m = /^(.+):(\d+)$/.exec(authority)
  return m ? { host: m[1]!, port: Number(m[2]) } : { host: authority, port: defaultPort }
}

function siteFor(server: Node, upstreams: Map<string, { host: string; port: number }[]>): ProxySite | null {
  const hosts = server.children
    ? find(server.children, 'server_name')
        .flatMap((n) => n.args)
        .filter((h) => h !== '_' && h !== '' && !h.startsWith('~'))
    : []
  if (hosts.length === 0) return null

  const site: ProxySite = { hosts, upstreams: [] }
  let root: string | undefined
  walk(server.children, (n) => {
    if (n.name === 'root' && n.args[0] && !root) root = n.args[0]
    if (n.name !== 'proxy_pass' || !n.args[0]) return
    const m = /^(https?):\/\/([^/\s]+)/.exec(n.args[0])
    if (!m) return
    const named = upstreams.get(m[2]!)
    const targets = named ?? [hostPort(m[2]!, m[1] === 'https' ? 443 : 80)]
    for (const t of targets) if (t) addUpstream(site, t.host, t.port)
  })
  if (site.upstreams.length === 0 && root) site.staticRoot = root
  return site
}

/** Sites of an nginx configuration (`nginx -T` output or nginx.conf): servers inside `http`. */
export function parseNginxConfig(text: string): ProxySite[] {
  const sites: ProxySite[] = []
  walk(parse(tokenize(text)), (node) => {
    if (node.name !== 'http' || !node.children) return
    const upstreams = new Map<string, { host: string; port: number }[]>()
    for (const u of find(node.children, 'upstream')) {
      const servers = (u.children ? find(u.children, 'server') : [])
        .map((s) => (s.args[0] ? hostPort(s.args[0], 80) : null))
        .filter((s): s is { host: string; port: number } => s !== null)
      if (u.args[0]) upstreams.set(u.args[0], servers)
    }
    for (const server of find(node.children, 'server')) {
      const site = siteFor(server, upstreams)
      if (site) sites.push(site)
    }
  })
  return sites
}

export const nginxProvider: ProxyProvider = {
  id: 'nginx',
  async detect({ exec, paths }) {
    try {
      const full = await exec.exec(buildCommand('nginxConfig'))
      if (full.code === 0 && full.stdout.trim()) return { available: true, sites: parseNginxConfig(full.stdout) }
    } catch {
      // nginx not installed or not allowed to dump its configuration: try the main file
    }
    try {
      paths.register(NGINX_CONF)
      const file = await exec.exec(buildCommand('readFile', { path: NGINX_CONF }, paths))
      if (file.code === 0 && file.stdout.trim()) return { available: true, sites: parseNginxConfig(file.stdout) }
    } catch {
      // unreadable
    }
    return { available: false, sites: [] }
  }
}
