import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { containerStatus } from '../../shared/status'
import type { Snapshot } from '../../shared/types'
import { StatusDot } from '../components/StatusDot'

export function Containers({
  snapshot,
  onOpenLogs,
  onRestart,
  onOpenProject
}: {
  snapshot: Snapshot
  onOpenLogs: (containerId: string) => void
  onRestart: (containerIds: string[]) => void
  onOpenProject?: (projectId: string) => void
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')

  if (snapshot.containers.length === 0) {
    return <p className="text-sm text-dim">{t('containers.empty')}</p>
  }

  // Pre-index project by container ID
  const projectByContainerId = new Map<string, { id: string; name: string }>()
  for (const p of snapshot.projects) {
    for (const cid of p.containerIds) {
      projectByContainerId.set(cid, { id: p.id, name: p.name })
    }
  }

  const normalized = filter.trim().toLowerCase()
  const filtered = snapshot.containers.filter((c) => {
    if (!normalized) return true
    const project = projectByContainerId.get(c.id)
    return (
      c.name.toLowerCase().includes(normalized) ||
      c.image.toLowerCase().includes(normalized) ||
      (project && project.name.toLowerCase().includes(normalized)) ||
      c.publishedPorts.some((p) => `${p.host}:${p.container}`.includes(normalized))
    )
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-fg">{t('containers.title')}</h2>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('containers.searchPlaceholder')}
          className="w-64 rounded-md border border-line bg-ink px-3 py-1.5 text-sm text-fg placeholder:text-dim focus:border-fg/40 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-dim">{t('containers.noMatches')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-panel">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold uppercase tracking-wider text-dim">
              <tr>
                <th className="py-2.5 pl-4 pr-2">Conteneur</th>
                <th className="px-3 py-2.5">{t('containers.image')}</th>
                <th className="px-3 py-2.5">{t('containers.ports')}</th>
                <th className="px-3 py-2.5">{t('containers.state')}</th>
                <th className="px-3 py-2.5">{t('containers.project')}</th>
                <th className="py-2.5 pl-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filtered.map((c) => {
                const status = containerStatus(c)
                const project = projectByContainerId.get(c.id)
                const ports = c.publishedPorts.map((p) => `${p.host}:${p.container}`).join(', ')

                return (
                  <tr key={c.id} className="hover:bg-panel-light/30">
                    <td className="py-3 pl-4 pr-2 font-medium text-fg">
                      <div className="flex items-center gap-2">
                        <StatusDot status={status} />
                        <span className="truncate">{c.name}</span>
                      </div>
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-3 font-mono text-xs text-dim" title={c.image}>
                      {c.image}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-dim">
                      {ports || '—'}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 capitalize text-fg">
                        {c.state}
                        {c.health && (
                          <span className={`text-[11px] ${c.health === 'healthy' ? 'text-ok' : c.health === 'unhealthy' ? 'text-bad' : 'text-warn'}`}>
                            ({c.health})
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {project ? (
                        onOpenProject ? (
                          <button
                            type="button"
                            onClick={() => onOpenProject(project.id)}
                            className="rounded bg-ink px-2 py-0.5 text-xs text-fg hover:underline"
                          >
                            {project.name}
                          </button>
                        ) : (
                          <span className="rounded bg-ink px-2 py-0.5 text-xs text-fg">{project.name}</span>
                        )
                      ) : (
                        <span className="text-dim italic">{t('containers.standalone')}</span>
                      )}
                    </td>
                    <td className="py-3 pl-2 pr-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenLogs(c.id)}
                          className="rounded border border-line bg-ink px-2.5 py-1 text-xs text-fg hover:border-fg/40 hover:bg-panel"
                        >
                          {t('containers.logs')}
                        </button>
                        <button
                          type="button"
                          onClick={() => onRestart([c.id])}
                          className="rounded border border-line bg-ink px-2.5 py-1 text-xs text-fg hover:border-fg/40 hover:bg-panel"
                        >
                          {t('containers.restart')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

