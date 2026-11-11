import { useTranslation } from 'react-i18next'
import { fleetStatus, fleetSummary } from '../../shared/fleet'
import type { ServerConfig, Snapshot } from '../../shared/types'
import { StatusDot } from '../components/StatusDot'

export function Fleet({
  servers,
  snapshots,
  onOpenServer,
  onOpenProject,
  onRetry
}: {
  servers: ServerConfig[]
  snapshots: Record<string, Snapshot>
  onOpenServer: (serverId: string) => void
  onOpenProject: (serverId: string, projectId: string) => void
  onRetry: (serverId: string) => void
}) {
  const { t } = useTranslation()
  const summary = fleetSummary(servers, snapshots)
  const overall = fleetStatus(servers, snapshots)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{t('tray.fleet')}</h1>
      </div>

      {overall === 'ok' && servers.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-ok/40 bg-panel px-4 py-2.5 text-sm text-ok">
          <StatusDot status="ok" />
          <span>{t('fleet.allHealthy', { count: servers.length })}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {summary.map((row) => {
          const s = row.server
          const snap = row.snapshot
          const isUnreachable = snap && !snap.reachable

          return (
            <div
              key={s.id}
              data-testid="server-card"
              onClick={() => onOpenServer(s.id)}
              className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-4 transition-colors hover:border-fg/30 cursor-pointer"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={row.status} />
                  <span className="font-medium text-fg">{s.name}</span>
                </div>
                <span className="text-xs text-dim">
                  {row.ageSeconds !== null ? t('fleet.ago', { seconds: row.ageSeconds }) : t('fleet.waiting')}
                </span>
              </div>

              {/* Unreachable state */}
              {isUnreachable ? (
                <div className="flex flex-col gap-2 rounded bg-ink/50 p-3 text-sm">
                  <p className="text-bad">{snap?.error?.message ?? t('home.unreachable')}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRetry(s.id)
                    }}
                    className="self-start rounded border border-line px-2.5 py-1 text-xs text-fg hover:bg-panel"
                  >
                    {t('fleet.retry')}
                  </button>
                </div>
              ) : row.hostPercent ? (
                <>
                  {/* Host metrics bars */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="flex justify-between text-dim">
                        <span>CPU</span>
                        <span>{row.hostPercent.cpu} %</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded bg-line">
                        <div
                          className="h-full bg-fg"
                          style={{ width: `${Math.min(100, row.hostPercent.cpu)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-dim">
                        <span>RAM</span>
                        <span>{row.hostPercent.mem} %</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded bg-line">
                        <div
                          className="h-full bg-fg"
                          style={{ width: `${Math.min(100, row.hostPercent.mem)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-dim">
                        <span>Disk</span>
                        <span>{row.hostPercent.disk} %</span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded bg-line">
                        <div
                          className="h-full bg-fg"
                          style={{ width: `${Math.min(100, row.hostPercent.disk)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Project status counts & issues */}
                  <div className="flex items-center justify-between border-t border-line/50 pt-2 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-ok">● {row.counts.ok}</span>
                      <span className="text-warn">● {row.counts.warn}</span>
                      <span className="text-bad">● {row.counts.error}</span>
                    </div>
                  </div>

                  {/* Top Issues */}
                  {row.topIssues.length > 0 && (
                    <div className="flex flex-col gap-1 rounded bg-ink/40 p-2 text-xs">
                      {row.topIssues.map((ti, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (ti.projectId) {
                              onOpenProject(s.id, ti.projectId)
                            } else {
                              onOpenServer(s.id)
                            }
                          }}
                          className="flex items-center gap-1.5 truncate text-left hover:underline"
                        >
                          <StatusDot status={ti.status} />
                          <span className="font-medium text-fg">{ti.projectName ?? s.name}</span>
                          <span className={ti.status === 'error' ? 'text-bad' : 'text-warn'}>
                            {('container' in ti.issue && ti.issue.container) || ti.issue.kind}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-dim">{t('fleet.waiting')}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
