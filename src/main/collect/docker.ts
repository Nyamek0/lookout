import type { ContainerInfo, ContainerUsage } from '../../shared/types'

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const UNITS: Record<string, number> = {
  B: 1,
  kB: 1e3,
  KB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4
}

/** "787.2kB" (docker df, decimal) and "120MiB" (docker stats, binary) to bytes; 0 when unreadable. */
export function parseSize(text: string): number {
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(text.trim())
  const unit = m ? UNITS[m[2]!] : undefined
  return m && unit ? Math.round(Number(m[1]) * unit) : 0
}

type Dict = Record<string, unknown>
const asDict = (v: unknown): Dict => (typeof v === 'object' && v !== null ? (v as Dict) : {})
const asString = (v: unknown): string => (typeof v === 'string' ? v : '')

const STATES = ['running', 'exited', 'restarting', 'paused', 'created', 'dead'] as const
const POLICIES = ['always', 'unless-stopped', 'on-failure'] as const

export function parseDockerInspect(json: string): ContainerInfo[] {
  if (!json.trim()) return []
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch (e) {
    throw new ParseError(`invalid docker inspect output: ${(e as Error).message}`)
  }
  if (!Array.isArray(data)) throw new ParseError('docker inspect output is not an array')

  return data.map((raw): ContainerInfo => {
    const o = asDict(raw)
    const config = asDict(o['Config'])
    const labels = asDict(config['Labels'])
    const state = asDict(o['State'])
    const status = asString(state['Status'])
    const policy = asString(asDict(asDict(o['HostConfig'])['RestartPolicy'])['Name'])
    const health = asString(asDict(state['Health'])['Status'])
    const label = (k: string): string | undefined => asString(labels[k]) || undefined

    const publishedPorts: ContainerInfo['publishedPorts'] = []
    for (const [key, bindings] of Object.entries(asDict(asDict(o['NetworkSettings'])['Ports']))) {
      const container = parseInt(key, 10)
      if (!Array.isArray(bindings)) continue
      for (const b of bindings) {
        const host = parseInt(asString(asDict(b)['HostPort']), 10)
        if (!Number.isNaN(host) && !publishedPorts.some((p) => p.host === host && p.container === container)) {
          publishedPorts.push({ host, container })
        }
      }
    }

    const files = label('com.docker.compose.project.config_files')
    return {
      id: asString(o['Id']).slice(0, 12),
      name: asString(o['Name']).replace(/^\//, ''),
      image: asString(config['Image']),
      service: label('com.docker.compose.service'),
      composeProject: label('com.docker.compose.project'),
      workingDir: label('com.docker.compose.project.working_dir'),
      configFiles: files ? files.split(',') : undefined,
      state: (STATES as readonly string[]).includes(status) ? (status as ContainerInfo['state']) : 'created',
      exitCode: typeof state['ExitCode'] === 'number' ? state['ExitCode'] : 0,
      health: health === 'healthy' || health === 'unhealthy' || health === 'starting' ? health : undefined,
      restartPolicy: (POLICIES as readonly string[]).includes(policy) ? (policy as ContainerInfo['restartPolicy']) : 'no',
      startedAt: asString(state['StartedAt']) || undefined,
      publishedPorts
    }
  })
}

/** `docker stats --no-stream --format '{{json .}}'`: one JSON object per line, keyed by short id. */
export function parseDockerStats(text: string): Record<string, ContainerUsage> {
  const out: Record<string, ContainerUsage> = {}
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const o = asDict(JSON.parse(line))
      const id = asString(o['ID'])
      if (!id) continue
      out[id] = {
        cpuPercent: parseFloat(asString(o['CPUPerc'])) || 0,
        memBytes: parseSize(asString(o['MemUsage']).split('/')[0] ?? '')
      }
    } catch {
      // skip a line that is not JSON (partial output)
    }
  }
  return out
}

/** `docker system df -v --format json`: a single object with Images / Volumes lists. */
export function parseDockerSystemDf(text: string): {
  volumes: Record<string, number>
  images: Record<string, number>
} {
  const result = { volumes: {} as Record<string, number>, images: {} as Record<string, number> }
  try {
    const o = asDict(JSON.parse(text))
    for (const v of Array.isArray(o['Volumes']) ? o['Volumes'] : []) {
      const d = asDict(v)
      result.volumes[asString(d['Name'])] = parseSize(asString(d['Size']))
    }
    for (const i of Array.isArray(o['Images']) ? o['Images'] : []) {
      const d = asDict(i)
      const repo = asString(d['Repository'])
      if (repo && repo !== '<none>') result.images[`${repo}:${asString(d['Tag'])}`] = parseSize(asString(d['Size']))
    }
  } catch {
    // disk sizes are optional: keep the empty maps
  }
  return result
}

export function classifyDockerError(stderr: string): 'permission_denied' | 'docker_unavailable' | null {
  const s = stderr.toLowerCase()
  if (s.includes('permission denied')) return 'permission_denied'
  if (
    s.includes('cannot connect to the docker daemon') ||
    s.includes('command not found') ||
    s.includes('is the docker daemon running')
  ) {
    return 'docker_unavailable'
  }
  return null
}
