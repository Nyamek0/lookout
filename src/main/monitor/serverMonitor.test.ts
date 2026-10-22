import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixture } from '../../../test/support/fixture'
import type { Snapshot } from '../../shared/types'
import { caddyProvider } from '../collect/caddy'
import type { DomainDeps } from '../collect/domains'
import type { Exec, ExecResult } from '../ssh/connection'
import { ServerMonitor } from './serverMonitor'

type Handler = (argv: string[]) => Partial<ExecResult> | undefined

function fakeExec(overrides: Handler = () => undefined): Exec & { calls: string[][] } {
  const calls: string[][] = []
  const base = (argv: string[]): Partial<ExecResult> => {
    const [a, b, c] = argv
    if (a === 'cat' && b === '/proc/stat') return { stdout: fixture('proc-stat.txt') }
    if (a === 'cat' && b === '/proc/meminfo') return { stdout: fixture('meminfo.txt') }
    if (a === 'cat' && b === '/proc/uptime') return { stdout: '1000.5 20.0\n' }
    if (a === 'df') return { stdout: fixture('df.txt') }
    if (a === 'nproc') return { stdout: '6\n' }
    if (a === 'docker' && b === 'ps') return { stdout: 'd58c008e9380\nabc123def456\n999999999999\n' }
    if (a === 'docker' && b === 'inspect') return { stdout: fixture('docker-inspect.json') }
    if (a === 'docker' && b === 'stats') return { stdout: fixture('docker-stats.txt') }
    if (a === 'docker' && b === 'system') return { stdout: fixture('docker-system-df.json') }
    if (a === 'curl') return { stdout: fixture('caddy-admin.json') }
    if (a === 'git' && c !== undefined && argv.includes('remote')) return { stdout: 'git@github.com:o/r.git\n' }
    if (a === 'git') return { stdout: 'abc1234\n2026-10-07T18:02:54+00:00\nfix\nHEAD -> main\n' }
    return { code: 1, stderr: 'unexpected command' }
  }
  return {
    calls,
    exec: async (argv) => {
      calls.push(argv)
      return { stdout: '', stderr: '', code: 0, ...base(argv), ...overrides(argv) }
    },
    stream: () => ({ stop() {} })
  }
}

const deps: DomainDeps = {
  resolve4: async () => ['1.2.3.4'],
  tlsProbe: async () => ({ validTo: new Date(Date.now() + 20 * 86_400_000 + 1000) })
}

const make = (exec: Exec, over: Partial<ConstructorParameters<typeof ServerMonitor>[0]> = {}) =>
  new ServerMonitor({ serverId: 's1', exec, serverIp: '1.2.3.4', deps, providers: [caddyProvider], ...over })

describe('ServerMonitor.refresh', () => {
  it('builds a snapshot with host metrics, projects, domains and disk', async () => {
    const snap = await make(fakeExec()).refresh()
    expect(snap).toMatchObject({ serverId: 's1', reachable: true, warnings: [] })
    expect(snap.host).toMatchObject({ memTotalBytes: 12254208 * 1024, diskTotalBytes: 211243098112, cores: 6, uptimeSeconds: 1000.5 })
    const backend = snap.projects.find((p) => p.name === 'backend')!
    expect(backend.domains.map((d) => d.host)).toEqual(['api.example.com'])
    expect(backend.domains[0]).toMatchObject({ matchesServer: true, tls: { ok: true, daysLeft: 20 } })
    expect(backend.diskBytes).toBe(1_200_000_000)
    expect(backend.git).toMatchObject({ branch: 'main', remote: 'git@github.com:o/r.git' })
    expect(snap.projects.find((p) => p.name === 'shop')!.diskBytes).toBe(432_787_200)
    expect(snap.projects.some((p) => p.kind === 'static')).toBe(true)
    expect(snap.status).toBe('error') // the fixture's "one-shot" container exited with code 1
  })

  it('reports cpu 0 on the first sample and a real value on the next', async () => {
    let n = 0
    const exec = fakeExec((argv) =>
      argv[1] === '/proc/stat' ? { stdout: n++ === 0 ? 'cpu  100 0 50 800 40 5 5 0 0 0\n' : 'cpu  150 0 75 850 40 5 5 0 0 0\n' } : undefined
    )
    const m = make(exec)
    expect((await m.refresh()).host?.cpuPercent).toBe(0)
    expect((await m.refresh()).host?.cpuPercent).toBeGreaterThan(0)
  })

  it('goes red and unreachable when the connection fails, then recovers', async () => {
    let down = true
    const exec: Exec = {
      exec: async (argv) => {
        if (down) throw new Error('ECONNRESET')
        return fakeExec().exec(argv)
      },
      stream: () => ({ stop() {} })
    }
    const m = make(exec)
    expect(await m.refresh()).toMatchObject({ reachable: false, status: 'error', host: null })
    down = false
    expect((await m.refresh()).reachable).toBe(true)
  })

  it('keeps host metrics and warns when docker refuses access', async () => {
    const exec = fakeExec((argv) =>
      argv[0] === 'docker'
        ? { code: 1, stderr: 'permission denied while trying to connect to the Docker daemon socket' }
        : argv[0] === 'curl' || argv[0] === 'cat' && argv[1] === '--'
          ? { code: 7 }
          : undefined
    )
    const snap = await make(exec).refresh()
    expect(snap.host?.cores).toBe(6)
    expect(snap.warnings).toContain('permission_denied')
    expect(snap.projects.filter((p) => p.kind !== 'static')).toEqual([])
  })

  it('warns and keeps projects without domains when no proxy can be read', async () => {
    const exec = fakeExec((argv) => (argv[0] === 'curl' || (argv[0] === 'cat' && argv[1] === '--') ? { code: 1 } : undefined))
    const snap = await make(exec).refresh()
    expect(snap.warnings).toContain('proxy_unavailable')
    expect(snap.projects.find((p) => p.name === 'backend')!.domains).toEqual([])
  })

  it('never reads a file outside the paths it discovered', async () => {
    const exec = fakeExec()
    await make(exec).refresh()
    const reads = exec.calls.filter((a) => a[0] === 'cat' && a[1] === '--').map((a) => a[2])
    expect(reads.every((p) => p === '/etc/caddy/Caddyfile')).toBe(true)
  })
})

const failing = (when: (argv: string[]) => boolean, error: Error, base = fakeExec()): Exec & { calls: string[][] } => ({
  calls: base.calls,
  exec: async (argv, o) => {
    if (when(argv)) {
      base.calls.push(argv)
      throw error
    }
    return base.exec(argv, o)
  },
  stream: base.stream
})
const timedOut = () => new Error('command timed out after 30000 ms')

describe('ServerMonitor degrades instead of going red', () => {
  it('keeps the host metrics and warns when docker hangs', async () => {
    const snap = await make(failing((a) => a[0] === 'docker', timedOut())).refresh()
    expect(snap.reachable).toBe(true)
    expect(snap.host?.cores).toBe(6)
    expect(snap.warnings).toContain('docker_unavailable')
    expect(snap.error).toBeUndefined()
  })

  it('does not relaunch a slow docker disk scan every cycle', async () => {
    const exec = failing((a) => a[1] === 'system', timedOut())
    const m = make(exec)
    await m.refresh()
    await m.refresh()
    expect(exec.calls.filter((a) => a[1] === 'system')).toHaveLength(1)
    expect((await m.refresh()).reachable).toBe(true)
  })

  it('ignores a container that vanished between listing and inspecting', async () => {
    // docker inspect prints the objects it found, reports the missing one on stderr, and exits 1
    const exec = fakeExec((argv) =>
      argv[1] === 'inspect' ? { code: 1, stderr: 'Error: No such object: 111111111111', stdout: fixture('docker-inspect.json') } : undefined
    )
    const snap = await make(exec).refresh()
    expect(snap.warnings).not.toContain('docker_unavailable')
    expect(snap.projects.some((p) => p.name === 'backend')).toBe(true)
  })

  it('warns when docker lists containers but nothing can be read from them', async () => {
    const exec = fakeExec((argv) => (argv[1] === 'inspect' ? { stdout: '[]' } : undefined))
    const snap = await make(exec).refresh()
    expect(snap.warnings).toContain('docker_unavailable')
  })
})

describe('ServerMonitor connection failures', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const statCalls = (e: { calls: string[][] }) => e.calls.filter((a) => a[1] === '/proc/stat').length
  const authError = () => Object.assign(new Error('All configured authentication methods failed'), { level: 'client-authentication' })

  it('stops polling after a failed login, shows why, and resumes only on retry', async () => {
    const exec = failing((a) => a[1] === '/proc/stat' || a[0] !== 'zzz', authError())
    const m = make(exec, { intervals: { activeMs: 5000, backgroundMs: 45000 } })
    m.setActive(true)
    const seen: Snapshot[] = []
    m.on('snapshot', (s: Snapshot) => seen.push(s))
    m.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(seen[0]).toMatchObject({ reachable: false, status: 'error', error: { kind: 'auth' } })
    const first = statCalls(exec)
    await vi.advanceTimersByTimeAsync(600_000)
    expect(statCalls(exec)).toBe(first)

    m.retry()
    await vi.advanceTimersByTimeAsync(0)
    expect(statCalls(exec)).toBeGreaterThan(first)
  })

  it('backs off on network errors: 5 s, then 10 s, then 20 s', async () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    const exec = failing(() => true, err)
    const m = make(exec, { intervals: { activeMs: 5000, backgroundMs: 45000 } })
    m.setActive(true)
    m.start()
    await vi.advanceTimersByTimeAsync(0)
    const at0 = statCalls(exec)
    await vi.advanceTimersByTimeAsync(5000)
    const at5 = statCalls(exec)
    expect(at5).toBeGreaterThan(at0)
    await vi.advanceTimersByTimeAsync(5000) // only 5 s since the last try: the next one waits 10 s
    expect(statCalls(exec)).toBe(at5)
    await vi.advanceTimersByTimeAsync(5000)
    expect(statCalls(exec)).toBeGreaterThan(at5)
    m.stop()
  })
})

describe('ServerMonitor polling', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const statCalls = (e: { calls: string[][] }) => e.calls.filter((a) => a[1] === '/proc/stat').length

  it('polls fast when active and slowly in the background', async () => {
    const exec = fakeExec()
    const m = make(exec, { intervals: { activeMs: 5000, backgroundMs: 45000 } })
    const seen: Snapshot[] = []
    m.on('snapshot', (s: Snapshot) => seen.push(s))
    m.setActive(true)
    m.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(statCalls(exec)).toBe(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(statCalls(exec)).toBe(2)

    m.setActive(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(statCalls(exec)).toBe(2)
    await vi.advanceTimersByTimeAsync(40000)
    expect(statCalls(exec)).toBe(3)
    expect(seen).toHaveLength(3)
    m.stop()
    await vi.advanceTimersByTimeAsync(60000)
    expect(statCalls(exec)).toBe(3)
  })
})
