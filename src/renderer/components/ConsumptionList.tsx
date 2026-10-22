import { useTranslation } from 'react-i18next'
import { DEFAULT_THRESHOLDS } from '../../shared/thresholds'
import type { Project } from '../../shared/types'
import { formatBytes, formatPercent } from '../format'
import { StatusDot } from './StatusDot'

/** The reason a project is not green, in the words a person would use. */
function cause(p: Project, hostMemTotalBytes: number, errorLabel: string): string | null {
  if (p.status === 'error') return errorLabel
  if (p.status !== 'warn') return null
  if (p.usage.cpuPercent > DEFAULT_THRESHOLDS.cpuPercent) return `CPU ${formatPercent(p.usage.cpuPercent)}`
  return `RAM ${formatPercent(hostMemTotalBytes ? (p.usage.memBytes / hostMemTotalBytes) * 100 : 0)}`
}

export function ConsumptionList({
  projects,
  hostMemTotalBytes,
  onOpen
}: {
  projects: Project[]
  hostMemTotalBytes: number
  onOpen: (projectId: string) => void
}) {
  const { t } = useTranslation()
  const sorted = [...projects].sort((a, b) => b.usage.memBytes - a.usage.memBytes)
  return (
    <ul className="flex flex-col">
      {sorted.map((p) => {
        const why = cause(p, hostMemTotalBytes, t('status.error'))
        const width = hostMemTotalBytes ? Math.min(100, (p.usage.memBytes / hostMemTotalBytes) * 100) : 0
        return (
          <li key={p.id}>
            <button
              type="button"
              data-testid="project-row"
              onClick={() => onOpen(p.id)}
              className="grid w-full grid-cols-[1rem_1fr_1fr_9rem] items-center gap-3 border-b border-line/60 py-2 text-left text-sm hover:bg-panel"
            >
              <StatusDot status={p.status} />
              <span className="truncate">{p.name}</span>
              <span className="h-1 overflow-hidden rounded bg-line">
                <span className={`block h-full ${p.status === 'warn' ? 'bg-warn' : 'bg-fg'}`} style={{ width: `${width}%` }} />
              </span>
              <span className="flex justify-end gap-2 text-right">
                {why && <span className={p.status === 'error' ? 'text-bad' : 'text-warn'}>{why}</span>}
                <span className="text-dim">{formatBytes(p.usage.memBytes)}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
