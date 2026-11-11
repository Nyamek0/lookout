import type { FleetServerSummary } from '../../shared/fleet'
import type { Status } from '../../shared/types'

export interface MenuItemDef {
  id?: string
  label?: string
  type?: 'separator' | 'normal'
  enabled?: boolean
  status?: Status
}

const STATUS_DOT: Record<Status, string> = {
  ok: '●',
  warn: '●',
  error: '●',
  neutral: '○'
}

export function trayMenuTemplate(
  summary: FleetServerSummary[],
  t: (key: string, opts?: Record<string, unknown>) => string
): MenuItemDef[] {
  const items: MenuItemDef[] = []

  if (summary.length === 0) {
    items.push({ label: t('tray.noServers'), enabled: false })
  } else {
    for (const row of summary) {
      const dot = STATUS_DOT[row.status]
      const topIssue = row.topIssues[0]
      let label = `${dot} ${row.server.name}`
      if (topIssue) {
        const issue = topIssue.issue
        const kind = issue.kind
        if (topIssue.projectName) {
          label += ` · ${topIssue.projectName} (${kind})`
        } else {
          label += ` · ${kind}`
        }
      }
      items.push({
        id: `server:${row.server.id}`,
        label,
        status: row.status
      })
    }
  }

  items.push({ type: 'separator' })
  items.push({ id: 'fleet', label: t('tray.fleet') })
  items.push({ id: 'open', label: t('tray.open') })
  items.push({ type: 'separator' })
  items.push({ id: 'quit', label: t('tray.quit') })

  return items
}
