import { useTranslation } from 'react-i18next'
import type { Snapshot } from '../../shared/types'
import { Card } from '../components/Card'
import { ConsumptionList } from '../components/ConsumptionList'
import { Sparkline } from '../components/Sparkline'
import { formatGB, formatPercent } from '../format'

const big = 'text-2xl font-semibold'

const ERROR_KEY = {
  auth: 'auth',
  'hostkey-refused': 'hostkeyRefused',
  'hostkey-changed': 'hostkeyChanged',
  network: 'network',
  other: 'other'
} as const

export function Home({
  snapshot,
  onOpenProject,
  onRetry,
  onRemove
}: {
  snapshot: Snapshot
  onOpenProject: (projectId: string) => void
  onRetry?: () => void
  onRemove?: () => void
}) {
  const { t } = useTranslation()
  const { host, warnings, error } = snapshot
  const diskPercent = host && host.diskTotalBytes ? (host.diskUsedBytes / host.diskTotalBytes) * 100 : 0
  const none = t('home.noData')
  // Polling pauses on these: the user has to act, so offer the retry here.
  const waitsForUser = error && error.kind !== 'network' && error.kind !== 'other'
  const btn = 'rounded-md border border-bad/60 px-2 py-1 text-xs hover:bg-bad/10'

  return (
    <div className="flex flex-col gap-5">
      {!snapshot.reachable && (
        <div role="alert" className="rounded-md border border-bad/60 bg-bad/10 px-3 py-2 text-sm text-bad">
          <strong>{t('home.unreachable')}</strong>
          {error && (
            <>
              <p className="mt-1">{t(`home.error.${ERROR_KEY[error.kind]}`)}</p>
              <p className="mt-1 text-xs opacity-80">{error.message}</p>
            </>
          )}
          <div className="mt-2 flex gap-2">
            {waitsForUser && onRetry && (
              <button type="button" className={btn} onClick={onRetry}>
                {t('home.retry')}
              </button>
            )}
            {onRemove && (
              <button type="button" className={btn} onClick={onRemove}>
                {t('home.removeServer')}
              </button>
            )}
          </div>
        </div>
      )}
      {(warnings.includes('permission_denied') || warnings.includes('docker_unavailable')) && (
        <div role="alert" className="rounded-md border border-warn/60 bg-warn/10 px-3 py-2 text-sm text-warn">
          <strong>{t('home.dockerUnavailable')}</strong>
          <p className="mt-1">{warnings.includes('permission_denied') ? t('home.dockerPermission') : t('home.dockerMissing')}</p>
        </div>
      )}
      {warnings.includes('proxy_unavailable') && <p className="text-xs text-dim">{t('home.proxyUnavailable')}</p>}

      <div className="grid grid-cols-3 gap-3">
        <Card title={t('home.cpu')}>
          <div className={big}>{host ? formatPercent(host.cpuPercent) : none}</div>
          <Sparkline values={snapshot.history.cpu} max={100} width={170} height={36} />
        </Card>
        <Card title={t('home.ram')}>
          <div className={big}>{host ? `${formatGB(host.memUsedBytes)} / ${formatGB(host.memTotalBytes)} GB` : none}</div>
          <Sparkline values={snapshot.history.mem} max={100} width={170} height={36} />
        </Card>
        <Card title={t('home.disk')}>
          <div className={big}>{host ? formatPercent(diskPercent) : none}</div>
          <div className="mt-4 h-1 overflow-hidden rounded bg-line">
            <div className="h-full bg-fg" style={{ width: `${Math.min(100, diskPercent)}%` }} />
          </div>
          {host && (
            <p className="mt-2 text-xs text-dim">
              {formatGB(host.diskUsedBytes)} / {formatGB(host.diskTotalBytes)} GB
            </p>
          )}
        </Card>
      </div>

      <section>
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-dim">{t('home.consuming')}</h2>
        {snapshot.projects.length === 0 ? (
          <p className="text-sm text-dim">{t('home.noProjects')}</p>
        ) : (
          <ConsumptionList projects={snapshot.projects} hostMemTotalBytes={host?.memTotalBytes ?? 0} onOpen={onOpenProject} />
        )}
      </section>

      {snapshot.undetected.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-dim">{t('home.notDetected')}</h2>
          <ul className="text-sm text-dim">
            {snapshot.undetected.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
