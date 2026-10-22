import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds'
import type { ContainerInfo, Status } from './types'

const RANK: Record<Status, number> = { neutral: 0, ok: 1, warn: 2, error: 3 }

export function containerStatus(c: ContainerInfo): Status {
  switch (c.state) {
    case 'restarting':
      return 'error'
    case 'running':
      return c.health === 'unhealthy' ? 'error' : 'ok'
    case 'exited':
    case 'dead':
      if (c.exitCode !== 0) return 'error'
      return c.restartPolicy === 'always' || c.restartPolicy === 'unless-stopped' ? 'error' : 'neutral'
    case 'paused':
      return 'warn'
    case 'created':
      // never started (e.g. "port is already allocated" leaves exit code 128): that is a failed start
      return c.exitCode !== 0 || c.restartPolicy === 'always' || c.restartPolicy === 'unless-stopped' ? 'error' : 'neutral'
    default:
      return 'neutral'
  }
}

export function worst(statuses: Status[]): Status {
  return statuses.reduce<Status>((acc, s) => (RANK[s] > RANK[acc] ? s : acc), 'neutral')
}

export function withThresholds(
  base: Status,
  u: { cpuPercent: number; memPercentOfHost: number },
  t: Thresholds = DEFAULT_THRESHOLDS
): Status {
  if (base !== 'ok') return base
  return u.cpuPercent > t.cpuPercent || u.memPercentOfHost > t.memPercentOfHost ? 'warn' : 'ok'
}

export function serverStatus(
  projects: Status[],
  host: { cpuPercent: number; memPercent: number; diskPercent: number } | null,
  t: Thresholds = DEFAULT_THRESHOLDS
): Status {
  if (!host) return 'error'
  const pressure =
    host.cpuPercent > t.host.cpuPercent ||
    host.memPercent > t.host.memPercent ||
    host.diskPercent > t.host.diskPercent
  return worst([...projects, pressure ? 'warn' : 'ok'])
}
