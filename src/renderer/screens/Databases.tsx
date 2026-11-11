import { useTranslation } from 'react-i18next'
import { detectDatabases } from '../../shared/databases'
import type { Snapshot } from '../../shared/types'
import { StatusDot } from '../components/StatusDot'
import { formatBytes } from '../format'

export function Databases({
  snapshot,
  onOpenProject,
  onOpenLogs
}: {
  snapshot: Snapshot
  onOpenProject?: (projectId: string) => void
  onOpenLogs?: (containerId: string) => void
}) {
  const { t } = useTranslation()
  const dbs = detectDatabases(snapshot.containers, snapshot.projects)

  if (dbs.length === 0) {
    return <p className="text-sm text-dim">{t('databases.empty')}</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-fg">{t('databases.title')}</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {dbs.map((db) => {
          const ports = db.ports.join(', ')

          return (
            <div
              key={db.id}
              className="flex flex-col justify-between gap-4 rounded-lg border border-line bg-panel p-4"
            >
              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StatusDot status={db.status} />
                    <span className="font-medium text-fg truncate">{db.name}</span>
                  </div>
                  <span className="rounded bg-ink px-2 py-0.5 font-mono text-xs font-medium text-fg">
                    {db.engineLabel}
                  </span>
                </div>

                {/* Image */}
                <div className="truncate font-mono text-xs text-dim" title={db.image}>
                  {db.image}
                </div>

                {/* Details list */}
                <div className="flex flex-col gap-1.5 border-t border-line/60 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-dim">{t('databases.ports')}</span>
                    <span className="font-mono text-fg">{ports || '—'}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-dim">{t('databases.volume')}</span>
                    <span className="text-fg">{db.diskBytes !== null ? formatBytes(db.diskBytes) : '—'}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-dim">{t('databases.project')}</span>
                    {db.projectName ? (
                      onOpenProject && db.projectId ? (
                        <button
                          type="button"
                          onClick={() => onOpenProject(db.projectId!)}
                          className="text-fg hover:underline"
                        >
                          {db.projectName}
                        </button>
                      ) : (
                        <span className="text-fg">{db.projectName}</span>
                      )
                    ) : (
                      <span className="text-dim italic">{t('databases.standalone')}</span>
                    )}
                  </div>

                  {db.health && (
                    <div className="flex justify-between">
                      <span className="text-dim">{t('databases.health')}</span>
                      <span className={db.health === 'healthy' ? 'text-ok' : db.health === 'unhealthy' ? 'text-bad' : 'text-warn'}>
                        {db.health}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {onOpenLogs && (
                <div className="border-t border-line/60 pt-3 text-right">
                  <button
                    type="button"
                    onClick={() => onOpenLogs(db.containerId)}
                    className="rounded border border-line bg-ink px-2.5 py-1 text-xs text-fg hover:border-fg/40 hover:bg-panel"
                  >
                    {t('databases.logs')}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
