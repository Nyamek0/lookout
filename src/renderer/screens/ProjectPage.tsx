import { useTranslation } from 'react-i18next'
import { containerStatus } from '../../shared/status'
import type { DomainCheck, Snapshot } from '../../shared/types'
import { Card } from '../components/Card'
import { Sparkline } from '../components/Sparkline'
import { StatusDot } from '../components/StatusDot'
import { formatBytes, formatPercent } from '../format'
import { useAppStore } from '../state/store'

const big = 'text-2xl font-semibold'
const row = 'flex justify-between gap-4 border-b border-line/60 py-1.5 text-sm last:border-0'

function DomainRow({ d }: { d: DomainCheck }) {
  const { t } = useTranslation()
  const tls = !d.tls
    ? t('project.tlsUnchecked')
    : d.tls.ok
      ? t('project.tlsOk', { days: d.tls.daysLeft ?? 0 })
      : t('project.tlsError', { error: d.tls.error ?? t('project.unknown') })
  return (
    <li className="py-1.5 text-sm">
      <div className="flex justify-between gap-4">
        <span className="truncate">{d.host}</span>
        <span className={d.tls?.ok ? 'text-ok' : d.tls ? 'text-bad' : 'text-dim'}>{tls}</span>
      </div>
      {d.matchesServer === false && <p className="text-xs text-warn">{t('project.dnsMismatch', { ips: d.ips.join(', ') })}</p>}
    </li>
  )
}

export function ProjectPage({
  snapshot,
  projectId,
  onOpenLogs,
  onRestart
}: {
  snapshot: Snapshot
  projectId: string
  onOpenLogs: (containerId: string) => void
  onRestart: (containerIds: string[]) => void
}) {
  const { t } = useTranslation()
  const history = useAppStore((s) => s.projectHistory[`${snapshot.serverId}:${projectId}`])
  const project = snapshot.projects.find((p) => p.id === projectId)
  if (!project) return <p className="text-sm text-dim">{t('project.notFound')}</p>

  const containers = snapshot.containers.filter((c) => project.containerIds.includes(c.id))
  const hasContainers = project.containerIds.length > 0
  const unknown = t('project.unknown')
  const git = project.git

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <StatusDot status={project.status} />
            {project.name}
          </h1>
          <p className="mt-1 text-xs text-dim">{t(`kind.${project.kind}`)}</p>
        </div>
        {hasContainers && (
          <div className="flex gap-2">
            <button type="button" onClick={() => onRestart(project.containerIds)} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-panel">
              {t('project.restart')}
            </button>
            <button type="button" onClick={() => onOpenLogs(project.containerIds[0]!)} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-panel">
              {t('project.logs')}
            </button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card title={t('project.disk')}>
          <div className={big}>{project.diskBytes === null ? t('home.noData') : formatBytes(project.diskBytes)}</div>
        </Card>
        {hasContainers && (
          <>
            <Card title={t('project.ram')}>
              <div className={big}>{formatBytes(project.usage.memBytes)}</div>
              <Sparkline values={history?.mem ?? []} width={170} height={30} />
            </Card>
            <Card title={t('project.cpu')}>
              <div className={big}>{formatPercent(project.usage.cpuPercent)}</div>
              <Sparkline values={history?.cpu ?? []} max={100} width={170} height={30} />
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card title={t('project.domains')}>
          {project.domains.length === 0 ? (
            <p className="text-sm text-dim">{t('project.noDomains')}</p>
          ) : (
            <ul>{project.domains.map((d) => <DomainRow key={d.host} d={d} />)}</ul>
          )}
        </Card>

        {hasContainers && (
          <Card title={t('project.containers')}>
            <ul>
              {containers.map((c) => (
                <li key={c.id} className={row}>
                  <span className="flex items-center gap-2">
                    <StatusDot status={containerStatus(c)} />
                    {c.name}
                  </span>
                  <span className="text-dim">{c.service ?? c.image}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={t('project.deployment')} className="col-span-2">
          {(project.staticRoot ?? project.workingDir) && (
            <div className={row}>
              <span className="text-dim">{t('project.folder')}</span>
              <span>{project.staticRoot ?? project.workingDir}</span>
            </div>
          )}
          <div className={row}><span className="text-dim">{t('project.repo')}</span><span>{git?.remote ?? unknown}</span></div>
          <div className={row}><span className="text-dim">{t('project.branch')}</span><span>{git?.branch ?? unknown}</span></div>
          <div className={row}>
            <span className="text-dim">{t('project.commit')}</span>
            <span>{git?.commit ? `${git.commit}${git.subject ? ` · ${git.subject}` : ''}` : unknown}</span>
          </div>
          <div className={row}><span className="text-dim">{t('project.method')}</span><span>{t(`project.method_${project.deployMethod}`)}</span></div>
          <div className={row}><span className="text-dim">{t('project.lastResult')}</span><span>{unknown}</span></div>
        </Card>
      </div>
    </div>
  )
}
