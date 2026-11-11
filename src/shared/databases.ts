import { containerStatus } from './status'
import type { ContainerInfo, Project, Status } from './types'

export type DatabaseEngine =
  | 'postgresql'
  | 'mysql'
  | 'mariadb'
  | 'redis'
  | 'mongodb'
  | 'clickhouse'
  | 'elasticsearch'
  | 'rabbitmq'

export interface DatabaseInfo {
  id: string
  name: string
  engine: DatabaseEngine
  engineLabel: string
  image: string
  containerId: string
  status: Status
  health?: 'healthy' | 'unhealthy' | 'starting'
  ports: number[]
  diskBytes: number | null
  projectName?: string
  projectId?: string
}

interface EngineDefinition {
  engine: DatabaseEngine
  engineLabel: string
  pattern: RegExp
}

const ENGINES: EngineDefinition[] = [
  { engine: 'postgresql', engineLabel: 'PostgreSQL', pattern: /postgres/i },
  { engine: 'mariadb', engineLabel: 'MariaDB', pattern: /mariadb/i },
  { engine: 'mysql', engineLabel: 'MySQL', pattern: /mysql/i },
  { engine: 'redis', engineLabel: 'Redis', pattern: /redis|valkey|keydb/i },
  { engine: 'mongodb', engineLabel: 'MongoDB', pattern: /mongo/i },
  { engine: 'clickhouse', engineLabel: 'ClickHouse', pattern: /clickhouse/i },
  { engine: 'elasticsearch', engineLabel: 'Elasticsearch', pattern: /elasticsearch|opensearch/i },
  { engine: 'rabbitmq', engineLabel: 'RabbitMQ', pattern: /rabbitmq/i }
]

function identifyEngine(c: ContainerInfo): { engine: DatabaseEngine; engineLabel: string } | null {
  for (const def of ENGINES) {
    if (def.pattern.test(c.image) || (c.service && def.pattern.test(c.service)) || def.pattern.test(c.name)) {
      return { engine: def.engine, engineLabel: def.engineLabel }
    }
  }
  return null
}

export function detectDatabases(containers: ContainerInfo[], projects: Project[]): DatabaseInfo[] {
  const dbs: DatabaseInfo[] = []

  // Pre-index projects by container ID
  const projectByContainerId = new Map<string, Project>()
  for (const p of projects) {
    for (const cid of p.containerIds) {
      projectByContainerId.set(cid, p)
    }
  }

  for (const c of containers) {
    const identified = identifyEngine(c)
    if (!identified) continue

    const project = projectByContainerId.get(c.id)
    const ports = c.publishedPorts.map((p) => p.host)

    dbs.push({
      id: `db:${c.id}`,
      name: c.name,
      engine: identified.engine,
      engineLabel: identified.engineLabel,
      image: c.image,
      containerId: c.id,
      status: containerStatus(c),
      health: c.health,
      ports,
      diskBytes: project?.diskBytes ?? null,
      projectName: project?.name,
      projectId: project?.id
    })
  }

  return dbs
}

