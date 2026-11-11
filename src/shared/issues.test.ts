import { describe, expect, it } from 'vitest'
import { projectIssues, serverIssues } from './issues'
import type { ContainerInfo, HostMetrics, Project, Snapshot } from './types'

const fakeHost: HostMetrics = {
  cpuPercent: 10,
  memUsedBytes: 1_000_000_000,
  memTotalBytes: 2_000_000_000,
  diskUsedBytes: 10_000_000_000,
  diskTotalBytes: 50_000_000_000,
  uptimeSeconds: 3600,
  cores: 4
}

function container(over: Partial<ContainerInfo> = {}): ContainerInfo {
  return {
    id: 'c1',
    name: 'app',
    image: 'img',
    state: 'running',
    exitCode: 0,
    restartPolicy: 'always',
    publishedPorts: [],
    ...over
  }
}

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'web',
    kind: 'compose',
    containerIds: ['c1'],
    domains: [],
    git: null,
    deployMethod: 'ci-image',
    diskBytes: 0,
    usage: { cpuPercent: 0, memBytes: 0 },
    status: 'ok',
    ...over
  }
}

describe('projectIssues', () => {
  it('reports nothing for a green project', () => {
    expect(projectIssues(project(), [container()], fakeHost)).toEqual([])
  })

  it('reports a failed container with its name and state', () => {
    const c = container({ name: 'worker', state: 'exited', exitCode: 137 })
    const p = project({ status: 'error' })
    expect(projectIssues(p, [c], fakeHost)).toEqual([
      { kind: 'stopped', status: 'error', container: 'worker', exitCode: 137 }
    ])
  })

  it('reports an unhealthy container as an error', () => {
    const c = container({ name: 'api', health: 'unhealthy' })
    const p = project({ status: 'error' })
    expect(projectIssues(p, [c], fakeHost)).toEqual([
      { kind: 'unhealthy', status: 'error', container: 'api' }
    ])
  })

  it('reports restarting containers as errors', () => {
    const c = container({ name: 'db', state: 'restarting' })
    const p = project({ status: 'error' })
    expect(projectIssues(p, [c], fakeHost)).toEqual([
      { kind: 'restarting', status: 'error', container: 'db' }
    ])
  })

  it('reports cpu and memory warnings with their values, sorted with worst first', () => {
    const p = project({
      status: 'warn',
      usage: { cpuPercent: 85, memBytes: 1_200_000_000 } // 60% of host RAM
    })
    const issues = projectIssues(p, [container()], fakeHost)
    expect(issues.map((i) => i.kind)).toEqual(['cpu', 'mem'])
    expect(issues[0]).toMatchObject({ kind: 'cpu', status: 'warn', percent: 85 })
    expect(issues[1]).toMatchObject({ kind: 'mem', status: 'warn', percent: 60 })
  })

  it('does not crash when host memory is unknown (0)', () => {
    const p = project({ status: 'warn', usage: { cpuPercent: 75, memBytes: 100 } })
    const issues = projectIssues(p, [container()], { ...fakeHost, memTotalBytes: 0 })
    expect(issues).toEqual([{ kind: 'cpu', status: 'warn', percent: 75 }])
  })
})

describe('serverIssues', () => {
  function snap(over: Partial<Snapshot> = {}): Snapshot {
    return {
      serverId: 's1',
      takenAt: Date.now(),
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

  it('reports unreachable servers with the reason category', () => {
    const s = snap({
      reachable: false,
      status: 'error',
      host: null,
      error: { kind: 'auth', message: 'Permission denied (publickey)' }
    })
    expect(serverIssues(s)).toEqual([
      { kind: 'unreachable', status: 'error', reason: 'auth', message: 'Permission denied (publickey)' }
    ])
  })

  it('reports host pressure (cpu, mem, disk) above thresholds', () => {
    const s = snap({
      status: 'warn',
      host: {
        ...fakeHost,
        cpuPercent: 95,
        memUsedBytes: 1_800_000_000, // 90%
        diskUsedBytes: 46_000_000_000 // 92%
      }
    })
    const issues = serverIssues(s)
    expect(issues.map((i) => i.kind)).toEqual(['host-cpu', 'host-mem', 'host-disk'])
  })

  it('reports missing docker as an error', () => {
    const s = snap({ status: 'warn', warnings: ['docker_unavailable'] })
    expect(serverIssues(s)).toContainEqual({ kind: 'docker_unavailable', status: 'warn' })
  })
})
