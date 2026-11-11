import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds'
import type { ConnectErrorKind, ContainerInfo, HostMetrics, Project, Snapshot, SnapshotWarning, Status } from './types'

export type ProjectIssueKind =
  | 'stopped'
  | 'restarting'
  | 'unhealthy'
  | 'paused'
  | 'cpu'
  | 'mem'
  | 'cert-expired'
  | 'cert-expiring'
  | 'error'

export interface ProjectIssue {
  kind: ProjectIssueKind
  status: 'warn' | 'error'
  container?: string
  exitCode?: number
  percent?: number
  domain?: string
  daysLeft?: number
}

export type ServerIssueKind =
  | 'unreachable'
  | 'host-cpu'
  | 'host-mem'
  | 'host-disk'
  | SnapshotWarning

export interface ServerIssue {
  kind: ServerIssueKind
  status: 'warn' | 'error'
  reason?: ConnectErrorKind
  message?: string
  percent?: number
}

const STATUS_RANK: Record<Status, number> = { error: 3, warn: 2, ok: 1, neutral: 0 }

export function projectIssues(
  project: Project,
  containers: ContainerInfo[],
  host: HostMetrics | null,
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): ProjectIssue[] {
  if (project.status === 'ok') return []

  const issues: ProjectIssue[] = []
  const matching =
    project.containerIds.length > 0 ? containers.filter((c) => project.containerIds.includes(c.id)) : containers

  for (const c of matching) {
    if (c.state === 'restarting') {
      issues.push({ kind: 'restarting', status: 'error', container: c.name })
    } else if (c.health === 'unhealthy') {
      issues.push({ kind: 'unhealthy', status: 'error', container: c.name })
    } else if (c.state === 'exited' || c.state === 'dead') {
      if (c.exitCode !== 0 || c.restartPolicy === 'always' || c.restartPolicy === 'unless-stopped') {
        issues.push({
          kind: 'stopped',
          status: 'error',
          container: c.name,
          ...(c.exitCode !== 0 ? { exitCode: c.exitCode } : {})
        })
      }
    } else if (c.state === 'paused') {
      issues.push({ kind: 'paused', status: 'warn', container: c.name })
    }
  }

  for (const d of project.domains) {
    if (d.tls) {
      if (!d.tls.ok || (d.tls.daysLeft !== undefined && d.tls.daysLeft < 0)) {
        issues.push({ kind: 'cert-expired', status: 'error', domain: d.host })
      } else if (d.tls.daysLeft !== undefined && d.tls.daysLeft <= 14) {
        issues.push({ kind: 'cert-expiring', status: 'warn', domain: d.host, daysLeft: d.tls.daysLeft })
      }
    }
  }

  if (project.usage.cpuPercent > thresholds.cpuPercent) {
    issues.push({ kind: 'cpu', status: 'warn', percent: Math.round(project.usage.cpuPercent) })
  }

  if (host && host.memTotalBytes > 0) {
    const memPercent = Math.round((project.usage.memBytes / host.memTotalBytes) * 100)
    if (memPercent > thresholds.memPercentOfHost) {
      issues.push({ kind: 'mem', status: 'warn', percent: memPercent })
    }
  }

  if (project.status === 'error' && issues.length === 0) {
    issues.push({ kind: 'error', status: 'error' })
  }

  return issues.sort((a, b) => {
    const diff = STATUS_RANK[b.status] - STATUS_RANK[a.status]
    if (diff !== 0) return diff
    return (b.percent ?? 0) - (a.percent ?? 0)
  })
}

export function serverIssues(snapshot: Snapshot, thresholds: Thresholds = DEFAULT_THRESHOLDS): ServerIssue[] {
  if (!snapshot.reachable) {
    return [
      {
        kind: 'unreachable',
        status: 'error',
        ...(snapshot.error?.kind ? { reason: snapshot.error.kind } : {}),
        ...(snapshot.error?.message ? { message: snapshot.error.message } : {})
      }
    ]
  }

  const issues: ServerIssue[] = []

  if (snapshot.host) {
    const h = snapshot.host
    if (h.cpuPercent > thresholds.host.cpuPercent) {
      issues.push({ kind: 'host-cpu', status: 'warn', percent: Math.round(h.cpuPercent) })
    }
    if (h.memTotalBytes > 0) {
      const memPercent = Math.round((h.memUsedBytes / h.memTotalBytes) * 100)
      if (memPercent > thresholds.host.memPercent) {
        issues.push({ kind: 'host-mem', status: 'warn', percent: memPercent })
      }
    }
    if (h.diskTotalBytes > 0) {
      const diskPercent = Math.round((h.diskUsedBytes / h.diskTotalBytes) * 100)
      if (diskPercent > thresholds.host.diskPercent) {
        issues.push({ kind: 'host-disk', status: 'warn', percent: diskPercent })
      }
    }
  }

  for (const w of snapshot.warnings) {
    issues.push({ kind: w, status: 'warn' })
  }

  return issues
}
