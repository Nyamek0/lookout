import { describe, expect, it } from 'vitest'
import { fleetStatus, fleetSummary } from './fleet'
import type { HostMetrics, Project, ServerConfig, Snapshot } from './types'

const fakeHost: HostMetrics = {
  cpuPercent: 20,
  memUsedBytes: 1_000_000_000,
  memTotalBytes: 2_000_000_000,
  diskUsedBytes: 10_000_000_000,
  diskTotalBytes: 50_000_000_000,
  uptimeSeconds: 3600,
  cores: 4
}

function server(id: string, name: string): ServerConfig {
  return { id, name, host: `${id}.example`, port: 22, user: 'root', authType: 'agent' }
}

function project(id: string, name: string, status: Project['status'], cpu = 0): Project {
  return {
    id,
    name,
    kind: 'compose',
    containerIds: [],
    domains: [],
    git: null,
    deployMethod: 'ci-image',
    diskBytes: 0,
    usage: { cpuPercent: cpu, memBytes: 100_000_000 },
    status
  }
}

function snap(serverId: string, over: Partial<Snapshot> = {}): Snapshot {
  return {
    serverId,
    takenAt: 1_000_000,
    reachable: true,
    host: fakeHost,
    history: { cpu: [], mem: [] },
    projects: [],
    containers: [],
    undetected: [],
    warnings: [],
    status: 'ok',
    ...over
  }
}

describe('fleetSummary', () => {
  it('orders servers by severity (error -> warn -> ok -> neutral), then by name', () => {
    const servers = [server('s1', 'alpha-ok'), server('s2', 'bravo-err'), server('s3', 'charlie-warn')]
    const snapshots: Record<string, Snapshot> = {
      s1: snap('s1', { status: 'ok' }),
      s2: snap('s2', { status: 'error' }),
      s3: snap('s3', { status: 'warn' })
    }
    const summary = fleetSummary(servers, snapshots, 1_010_000)
    expect(summary.map((s) => s.server.id)).toEqual(['s2', 's3', 's1'])
  })

  it('summarises counts of projects per status and extracts top issues', () => {
    const s = server('s1', 'prod')
    const projects: Project[] = [
      project('p1', 'api', 'ok'),
      project('p2', 'worker', 'error'),
      project('p3', 'db', 'warn', 80)
    ]
    const snapshots = { s1: snap('s1', { status: 'error', projects }) }
    const [row] = fleetSummary([s], snapshots, 1_005_000)
    expect(row?.counts).toEqual({ ok: 1, warn: 1, error: 1, neutral: 0 })
    expect(row?.status).toBe('error')
    expect(row?.topIssues.length).toBeGreaterThan(0)
    expect(row?.ageSeconds).toBe(5)
  })

  it('handles a server without a snapshot yet (waiting to connect)', () => {
    const s = server('s1', 'new')
    const [row] = fleetSummary([s], {}, 1_000_000)
    expect(row?.status).toBe('neutral')
    expect(row?.counts).toEqual({ ok: 0, warn: 0, error: 0, neutral: 0 })
    expect(row?.ageSeconds).toBeNull()
    expect(row?.hostPercent).toBeNull()
  })
})

describe('fleetStatus', () => {
  it('returns the worst status across all servers', () => {
    const servers = [server('s1', 'a'), server('s2', 'b')]
    expect(fleetStatus(servers, {})).toBe('neutral')
    expect(fleetStatus(servers, { s1: snap('s1', { status: 'ok' }) })).toBe('ok')
    expect(fleetStatus(servers, { s1: snap('s1', { status: 'ok' }), s2: snap('s2', { status: 'warn' }) })).toBe('warn')
    expect(fleetStatus(servers, { s1: snap('s1', { status: 'ok' }), s2: snap('s2', { status: 'error' }) })).toBe('error')
  })
})
