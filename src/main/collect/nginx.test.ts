import { describe, expect, it } from 'vitest'
import { PathRegistry } from '../security/pathRegistry'
import type { Exec } from '../ssh/connection'
import { nginxProvider, parseNginxConfig } from './nginx'
import { proxyProviders } from './providers'

const conf = (body: string) => `http {\n${body}\n}\n`

describe('parseNginxConfig', () => {
  it('reads host names and the proxied port', () => {
    const sites = parseNginxConfig(
      conf(`server {
        listen 443 ssl;
        server_name a.example.com b.example.com;
        location / { proxy_pass http://127.0.0.1:3000; }
      }`)
    )
    expect(sites).toEqual([
      { hosts: ['a.example.com', 'b.example.com'], upstreams: [{ host: '127.0.0.1', port: 3000 }] }
    ])
  })

  it('resolves a named upstream block', () => {
    const sites = parseNginxConfig(
      conf(`upstream app { server 127.0.0.1:8080; server 127.0.0.1:8081 weight=2; }
      server { server_name app.example.com; location / { proxy_pass http://app; } }`)
    )
    expect(sites[0]!.upstreams).toEqual([
      { host: '127.0.0.1', port: 8080 },
      { host: '127.0.0.1', port: 8081 }
    ])
  })

  it('finds a proxy_pass inside a nested location and ignores the url path', () => {
    const sites = parseNginxConfig(
      conf(`server { server_name x.example.com;
        location /api/ { if ($a) { proxy_pass http://127.0.0.1:9000/v1/; } }
      }`)
    )
    expect(sites[0]!.upstreams).toEqual([{ host: '127.0.0.1', port: 9000 }])
  })

  it('uses the default port of the scheme when none is given', () => {
    const sites = parseNginxConfig(conf(`server { server_name y.example.com; location / { proxy_pass https://backend.internal; } }`))
    expect(sites[0]!.upstreams).toEqual([{ host: 'backend.internal', port: 443 }])
  })

  it('treats a site with only a root as a static site', () => {
    const sites = parseNginxConfig(conf(`server { server_name s.example.com; root /var/www/site; index index.html; }`))
    expect(sites).toEqual([{ hosts: ['s.example.com'], upstreams: [], staticRoot: '/var/www/site' }])
  })

  it('skips catch-all servers and servers without a name', () => {
    const sites = parseNginxConfig(
      conf(`server { listen 80 default_server; server_name _; return 444; }
      server { listen 8080; location / { proxy_pass http://127.0.0.1:1; } }`)
    )
    expect(sites).toEqual([])
  })

  it('ignores comments and quoted text', () => {
    const sites = parseNginxConfig(
      conf(`# server { server_name hidden.example.com; }
      server { server_name real.example.com; add_header X-Note "has a ; and a { inside"; location / { proxy_pass http://127.0.0.1:5000; } }`)
    )
    expect(sites.map((s) => s.hosts)).toEqual([['real.example.com']])
  })

  it('never throws on empty, partial or unbalanced input', () => {
    expect(parseNginxConfig('')).toEqual([])
    expect(parseNginxConfig('server { server_name a.example.com;')).toEqual([])
    expect(parseNginxConfig('}}} {{{ ;;;')).toEqual([])
  })
})

function fakeExec(handler: (argv: string[]) => { stdout: string; code: number }): Exec {
  return { exec: async (argv) => ({ stderr: '', ...handler(argv) }), stream: () => ({ stop() {} }) }
}
const SITE = conf(`server { server_name n.example.com; location / { proxy_pass http://127.0.0.1:4000; } }`)

describe('nginxProvider', () => {
  it('reads the full configuration with nginx -T', async () => {
    const exec = fakeExec((argv) => (argv[0] === 'nginx' ? { stdout: SITE, code: 0 } : { stdout: '', code: 1 }))
    const r = await nginxProvider.detect({ exec, paths: new PathRegistry() })
    expect(r.available).toBe(true)
    expect(r.sites[0]!.hosts).toEqual(['n.example.com'])
  })

  it('falls back to /etc/nginx/nginx.conf', async () => {
    const exec = fakeExec((argv) => (argv[0] === 'cat' ? { stdout: SITE, code: 0 } : { stdout: '', code: 127 }))
    const r = await nginxProvider.detect({ exec, paths: new PathRegistry() })
    expect(r.available).toBe(true)
    expect(r.sites).toHaveLength(1)
  })

  it('reports unavailable without throwing when nginx is absent', async () => {
    const r = await nginxProvider.detect({ exec: fakeExec(() => ({ stdout: '', code: 1 })), paths: new PathRegistry() })
    expect(r).toEqual({ available: false, sites: [] })
  })
})

describe('proxy providers registry', () => {
  it('knows caddy and nginx', () => {
    expect(proxyProviders.map((p) => p.id)).toEqual(['caddy', 'nginx'])
  })
})
