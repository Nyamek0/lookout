import { projectIssues, serverIssues, type ProjectIssue, type ServerIssue } from '../../shared/issues'
import type { Preferences, Snapshot, Status } from '../../shared/types'

export type AlertLevel = 'error' | 'warn' | 'recovered' | 'action'

export interface AlertItem {
  projectId?: string
  projectName?: string
  issue: ProjectIssue | ServerIssue
}

export interface Alert {
  serverId: string
  level: AlertLevel
  items: AlertItem[]
}

export interface AlertTrackerOptions {
  now?: () => number
  confirmations?: number
  minIntervalMs?: number
}

interface EntityState {
  confirmedStatus: Status
  candidateStatus: Status | null
  candidateCount: number
  lastAlertedAt: number
  lastAlertedLevel: AlertLevel | null
}

interface ServerState {
  baselineSet: boolean
  actionNotified: boolean
  entities: Map<string, EntityState>
}

const LEVEL_RANK: Record<AlertLevel, number> = {
  action: 4,
  error: 3,
  warn: 2,
  recovered: 1
}

export class AlertTracker {
  private readonly now: () => number
  private readonly confirmations: number
  private readonly minIntervalMs: number
  private readonly servers = new Map<string, ServerState>()

  constructor(opts: AlertTrackerOptions = {}) {
    this.now = opts.now ?? Date.now
    this.confirmations = opts.confirmations ?? 2
    this.minIntervalMs = opts.minIntervalMs ?? 1_800_000
  }

  forget(serverId: string): void {
    this.servers.delete(serverId)
  }

  observe(snapshot: Snapshot, prefs: Preferences): Alert[] {
    if (!prefs.notifications.enabled) return []

    const serverId = snapshot.serverId
    let state = this.servers.get(serverId)
    if (!state) {
      state = { baselineSet: false, actionNotified: false, entities: new Map() }
      this.servers.set(serverId, state)
    }

    const now = this.now()

    // Auth / hostkey issues are special: action required
    if (!snapshot.reachable && snapshot.error) {
      const k = snapshot.error.kind
      if (k === 'auth' || k === 'hostkey-refused' || k === 'hostkey-changed') {
        if (!state.actionNotified) {
          state.actionNotified = true
          state.baselineSet = true
          const sIssues = serverIssues(snapshot)
          return [
            {
              serverId,
              level: 'action',
              items: sIssues.map((issue) => ({ issue }))
            }
          ]
        }
        return []
      }
    } else {
      state.actionNotified = false
    }

    // Determine current statuses for all entities
    const currentEntities = new Map<string, { status: Status; projectId?: string; projectName?: string }>()

    // Server entity
    currentEntities.set('__server__', { status: snapshot.status })

    // Project entities
    for (const p of snapshot.projects) {
      currentEntities.set(`project:${p.id}`, { status: p.status, projectId: p.id, projectName: p.name })
    }

    const isFirstSnapshot = !state.baselineSet
    state.baselineSet = true

    const triggeredLevels: AlertLevel[] = []

    for (const [key, ent] of currentEntities) {
      let entityState = state.entities.get(key)
      if (!entityState) {
        entityState = {
          confirmedStatus: 'ok',
          candidateStatus: ent.status !== 'ok' ? ent.status : null,
          candidateCount: ent.status !== 'ok' ? 1 : 0,
          lastAlertedAt: 0,
          lastAlertedLevel: null
        }
        state.entities.set(key, entityState)
        continue
      }

      if (ent.status === entityState.confirmedStatus) {
        entityState.candidateStatus = null
        entityState.candidateCount = 0
        continue
      }

      if (ent.status === entityState.candidateStatus) {
        entityState.candidateCount++
      } else {
        entityState.candidateStatus = ent.status
        entityState.candidateCount = 1
      }

      if (entityState.candidateCount >= this.confirmations) {
        const prevStatus = entityState.confirmedStatus
        entityState.confirmedStatus = ent.status
        entityState.candidateStatus = null
        entityState.candidateCount = 0

        if (ent.status === 'error') {
          // Escalation from warn to error or transition from ok to error bypasses cooldown
          const isEscalation = entityState.lastAlertedLevel !== 'error'
          const cooldownExpired = entityState.lastAlertedAt === 0 || now - entityState.lastAlertedAt >= this.minIntervalMs
          if (isEscalation || cooldownExpired) {
            triggeredLevels.push('error')
            entityState.lastAlertedAt = now
            entityState.lastAlertedLevel = 'error'
          }
        } else if (ent.status === 'warn') {
          if (prefs.notifications.warnings) {
            const cooldownExpired = entityState.lastAlertedAt === 0 || now - entityState.lastAlertedAt >= this.minIntervalMs
            if (cooldownExpired) {
              triggeredLevels.push('warn')
              entityState.lastAlertedAt = now
              entityState.lastAlertedLevel = 'warn'
            }
          }
        } else if (ent.status === 'ok') {
          if ((prevStatus === 'error' || prevStatus === 'warn') && prefs.notifications.recoveries) {
            triggeredLevels.push('recovered')
            entityState.lastAlertedAt = now
            entityState.lastAlertedLevel = 'recovered'
          }
        }
      }
    }

    if (isFirstSnapshot || triggeredLevels.length === 0) {
      return []
    }

    // Determine highest level
    triggeredLevels.sort((a, b) => LEVEL_RANK[b] - LEVEL_RANK[a])
    const topLevel = triggeredLevels[0]!

    // Gather all active issues on this server
    const items: AlertItem[] = []

    for (const p of snapshot.projects) {
      if (p.status === 'error' || (p.status === 'warn' && prefs.notifications.warnings)) {
        const issues = projectIssues(p, snapshot.containers, snapshot.host)
        if (issues.length > 0) {
          for (const issue of issues) {
            items.push({ projectId: p.id, projectName: p.name, issue })
          }
        } else {
          items.push({ projectId: p.id, projectName: p.name, issue: { kind: 'error', status: p.status } })
        }
      }
    }

    const sIssues = serverIssues(snapshot)
    for (const issue of sIssues) {
      items.push({ issue })
    }

    return [
      {
        serverId,
        level: topLevel,
        items
      }
    ]
  }
}
