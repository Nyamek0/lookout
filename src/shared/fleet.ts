import { projectIssues, serverIssues, type ProjectIssue, type ServerIssue } from './issues'
import { worst } from './status'
import { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds'
import type { ServerConfig, Snapshot, Status } from './types'

export interface FleetIssue {
  serverId: string
  projectId?: string
  projectName?: string
  issue: ProjectIssue | ServerIssue
  status: Status
}

export interface FleetServerSummary {
  server: ServerConfig
  snapshot?: Snapshot
  status: Status
  counts: Record<Status, number>
  topIssues: FleetIssue[]
  ageSeconds: number | null
  hostPercent: { cpu: number; mem: number; disk: number } | null
}

const STATUS_RANK: Record<Status, number> = { error: 3, warn: 2, ok: 1, neutral: 0 }

export function fleetStatus(servers: ServerConfig[], snapshots: Record<string, Snapshot>): Status {
  if (servers.length === 0) return 'neutral'
  const statuses = servers.map((s) => snapshots[s.id]?.status ?? 'neutral')
  return worst(statuses)
}

export function fleetSummary(
  servers: ServerConfig[],
  snapshots: Record<string, Snapshot>,
  now: number = Date.now(),
  thresholds: Thresholds = DEFAULT_THRESHOLDS
): FleetServerSummary[] {
  const rows: FleetServerSummary[] = []

  for (const s of servers) {
    const snap = snapshots[s.id]
    const status: Status = snap?.status ?? 'neutral'
    const counts: Record<Status, number> = { ok: 0, warn: 0, error: 0, neutral: 0 }
    const allIssues: FleetIssue[] = []

    let hostPercent: { cpu: number; mem: number; disk: number } | null = null
    let ageSeconds: number | null = null

    if (snap) {
      ageSeconds = Math.max(0, Math.floor((now - snap.takenAt) / 1000))

      if (snap.host) {
        hostPercent = {
          cpu: Math.round(snap.host.cpuPercent),
          mem:
            snap.host.memTotalBytes > 0
              ? Math.round((snap.host.memUsedBytes / snap.host.memTotalBytes) * 100)
              : 0,
          disk:
            snap.host.diskTotalBytes > 0
              ? Math.round((snap.host.diskUsedBytes / snap.host.diskTotalBytes) * 100)
              : 0
        }
      }

      for (const p of snap.projects) {
        counts[p.status] = (counts[p.status] ?? 0) + 1
        const pIssues = projectIssues(p, snap.containers, snap.host, thresholds)
        if (pIssues.length > 0) {
          for (const pi of pIssues) {
            allIssues.push({
              serverId: s.id,
              projectId: p.id,
              projectName: p.name,
              issue: pi,
              status: pi.status
            })
          }
        } else if (p.status === 'error' || p.status === 'warn') {
          allIssues.push({
            serverId: s.id,
            projectId: p.id,
            projectName: p.name,
            issue: { kind: 'error', status: p.status },
            status: p.status
          })
        }
      }

      const sIssues = serverIssues(snap, thresholds)
      for (const si of sIssues) {
        allIssues.push({
          serverId: s.id,
          issue: si,
          status: si.status
        })
      }
    }

    allIssues.sort((a, b) => {
      const diff = STATUS_RANK[b.status] - STATUS_RANK[a.status]
      if (diff !== 0) return diff
      const pB = (b.issue as { percent?: number }).percent ?? 0
      const pA = (a.issue as { percent?: number }).percent ?? 0
      return pB - pA
    })

    rows.push({
      server: s,
      snapshot: snap,
      status,
      counts,
      topIssues: allIssues.slice(0, 3),
      ageSeconds,
      hostPercent
    })
  }

  rows.sort((a, b) => {
    const diff = STATUS_RANK[b.status] - STATUS_RANK[a.status]
    if (diff !== 0) return diff
    return a.server.name.localeCompare(b.server.name)
  })

  return rows
}
