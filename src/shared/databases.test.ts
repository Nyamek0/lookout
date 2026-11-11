import { describe, expect, it } from 'vitest'
import { detectDatabases } from './databases'
import type { ContainerInfo, Project } from './types'

function c(over: Partial<ContainerInfo> = {}): ContainerInfo {
  return {
    id: 'c1',
    name: 'app',
    image: 'node:20-alpine',
    state: 'running',
    exitCode: 0,
    restartPolicy: 'always',
    publishedPorts: [],
    ...over
  }
}

function p(over: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'web',
    kind: 'compose',
    containerIds: [],
    domains: [],
    git: null,
    deployMethod: 'ci-image',
    diskBytes: 100_000_000,
    usage: { cpuPercent: 0, memBytes: 0 },
    status: 'ok',
    ...over
  }
}

describe('detectDatabases', () => {
  it('returns empty list when no database containers exist', () => {
    const containers = [
      c({ name: 'web-api', image: 'my-app:latest' }),
      c({ name: 'caddy-proxy', image: 'caddy:2.8-alpine' })
    ]
    expect(detectDatabases(containers, [])).toEqual([])
  })

  it('detects common database engines (Postgres, Redis, MySQL, MongoDB)', () => {
    const containers = [
      c({ id: 'pg1', name: 'prod-db', image: 'postgres:16-alpine', publishedPorts: [{ host: 5432, container: 5432 }] }),
      c({ id: 'rd1', name: 'cache', image: 'redis:7.2-alpine', publishedPorts: [{ host: 6379, container: 6379 }] }),
      c({ id: 'my1', name: 'store', image: 'mysql:8.0', publishedPorts: [{ host: 3306, container: 3306 }] }),
      c({ id: 'mg1', name: 'docs', image: 'mongo:6.0', publishedPorts: [{ host: 27017, container: 27017 }] })
    ]

    const dbs = detectDatabases(containers, [])
    expect(dbs).toHaveLength(4)

    expect(dbs[0]).toMatchObject({
      containerId: 'pg1',
      name: 'prod-db',
      engine: 'postgresql',
      engineLabel: 'PostgreSQL',
      ports: [5432]
    })

    expect(dbs[1]).toMatchObject({
      containerId: 'rd1',
      name: 'cache',
      engine: 'redis',
      engineLabel: 'Redis',
      ports: [6379]
    })

    expect(dbs[2]).toMatchObject({
      containerId: 'my1',
      name: 'store',
      engine: 'mysql',
      engineLabel: 'MySQL',
      ports: [3306]
    })

    expect(dbs[3]).toMatchObject({
      containerId: 'mg1',
      name: 'docs',
      engine: 'mongodb',
      engineLabel: 'MongoDB',
      ports: [27017]
    })
  })

  it('associates database with its parent project', () => {
    const pg = c({ id: 'pg1', name: 'web-postgres', image: 'postgres:15' })
    const project = p({ id: 'compose:web', name: 'web', containerIds: ['pg1'], diskBytes: 500_000_000 })

    const dbs = detectDatabases([pg], [project])
    expect(dbs[0]).toMatchObject({
      containerId: 'pg1',
      projectName: 'web',
      projectId: 'compose:web',
      diskBytes: 500_000_000
    })
  })

  it('detects engine from service name when image is generic or custom', () => {
    const customPg = c({ id: 'c9', name: 'custom-db', service: 'postgres', image: 'registry.mycorp.com/custom-base:latest' })
    const dbs = detectDatabases([customPg], [])
    expect(dbs[0]?.engine).toBe('postgresql')
  })
})

