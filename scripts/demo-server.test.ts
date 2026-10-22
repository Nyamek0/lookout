import { afterEach, describe, expect, it } from 'vitest'
import { fixture } from '../test/support/fixture'
import type { FakeVps } from '../test/support/fakeVps'
import { ServerMonitor } from '../src/main/monitor/serverMonitor'
import { SshConnection } from '../src/main/ssh/connection'
import { KnownHosts } from '../src/main/ssh/hostKeys'
import { demoHandler, startDemoServer } from './demo-server'

const servers: FakeVps[] = []
const conns: SshConnection[] = []

afterEach(async () => {
  conns.splice(0).forEach((c) => c.close())
  await Promise.all(servers.splice(0).map((s) => s.stop()))
})

async function connect() {
  const vps = await startDemoServer(0)
  servers.push(vps)
  const c = new SshConnection({
    host: '127.0.0.1', port: vps.port, user: 'demo', auth: { type: 'password', password: 'demo' },
    knownHosts: new KnownHosts(), onUnknownHost: async () => true
  })
  conns.push(c)
  return c
}

describe('demoHandler', () => {
  it('answers read commands with the recorded fixtures', async () => {
    const h = demoHandler()
    expect((await h(['cat', '/proc/meminfo'])).stdout).toBe(fixture('meminfo.txt'))
    expect((await h(['docker', 'inspect', 'abc123def456'])).stdout).toBe(fixture('docker-inspect.json'))
    expect((await h(['docker', 'ps', '-aq'])).code).toBe(0)
  })

  it('moves the cpu counters on every call so the demo looks alive', async () => {
    const h = demoHandler()
    const a = (await h(['cat', '/proc/stat'])).stdout
    const b = (await h(['cat', '/proc/stat'])).stdout
    expect(a).not.toBe(b)
    expect(a.startsWith('cpu ')).toBe(true)
  })

  it('serves timestamped logs and accepts a restart without touching anything', async () => {
    const h = demoHandler()
    const logs = (await h(['docker', 'logs', '--timestamps', '--tail', '20', 'abc123def456'])).stdout.trim().split('\n')
    expect(logs.length).toBeGreaterThan(1)
    expect(logs[0]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z /)
    expect((await h(['docker', 'restart', 'abc123def456'])).code).toBe(0)
  })

  it('keeps a followed log stream open instead of ending it at once', async () => {
    const pending = demoHandler()(['docker', 'logs', '--timestamps', '--follow', '--tail', '0', 'abc123def456'])
    const winner = await Promise.race([pending, new Promise((r) => setTimeout(() => r('still open'), 80))])
    expect(winner).toBe('still open')
  })

  it('refuses anything it does not know', async () => {
    expect((await demoHandler()(['rm', '-rf', '/'])).code).not.toBe(0)
  })
})

describe('demo server end to end', () => {
  it('lets the real ssh client run a command over ssh', async () => {
    const c = await connect()
    expect((await c.exec(['cat', '/proc/meminfo'])).stdout).toBe(fixture('meminfo.txt'))
    expect((await c.exec(['rm', '-rf', '/'])).code).not.toBe(0)
  })

  it('feeds the real monitor a complete snapshot: projects, domains and a restart-ready container', async () => {
    const c = await connect()
    const monitor = new ServerMonitor({
      serverId: 'demo', exec: c, serverIp: '127.0.0.1',
      deps: { resolve4: async () => ['127.0.0.1'], tlsProbe: async () => ({ validTo: new Date(Date.now() + 40 * 86_400_000) }) }
    })
    const snap = await monitor.refresh()
    expect(snap.reachable).toBe(true)
    expect(snap.projects.map((p) => p.name)).toEqual(expect.arrayContaining(['backend', 'shop']))
    expect(snap.containers.length).toBeGreaterThan(0)
  })
})
