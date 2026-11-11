import { useTranslation } from 'react-i18next'
import type { DeployMethod, Snapshot } from '../../shared/types'
import { StatusDot } from '../components/StatusDot'

export function Deployments({
  snapshot,
  onOpenProject
}: {
  snapshot: Snapshot
  onOpenProject: (projectId: string) => void
}) {
  const { t } = useTranslation()

  if (snapshot.projects.length === 0) {
    return <p className="text-sm text-dim">{t('deployments.empty')}</p>
  }

  const methodLabel = (method: DeployMethod): string => {
    switch (method) {
      case 'ci-image':
        return t('deployments.methodCi')
      case 'git-pull':
        return t('deployments.methodGit')
      case 'file-copy':
        return t('deployments.methodFile')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-fg">{t('deployments.title')}</h2>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs font-semibold uppercase tracking-wider text-dim">
            <tr>
              <th className="py-2.5 pl-4 pr-2">Projet</th>
              <th className="px-3 py-2.5">{t('deployments.method')}</th>
              <th className="px-3 py-2.5">{t('deployments.remote')}</th>
              <th className="px-3 py-2.5">{t('deployments.branch')}</th>
              <th className="px-3 py-2.5">{t('deployments.commit')}</th>
              <th className="py-2.5 pl-2 pr-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {snapshot.projects.map((p) => {
              const git = p.git
              const shortCommit = git?.commit ? git.commit.slice(0, 7) : null

              return (
                <tr key={p.id} className="hover:bg-panel-light/30">
                  <td className="py-3 pl-4 pr-2 font-medium text-fg">
                    <div className="flex items-center gap-2">
                      <StatusDot status={p.status} />
                      <span className="truncate">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs">
                    <span className="rounded bg-ink px-2 py-0.5 font-medium text-fg">
                      {methodLabel(p.deployMethod)}
                    </span>
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-3 font-mono text-xs text-dim" title={git?.remote ?? undefined}>
                    {git?.remote ?? '—'}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-dim">
                    {git?.branch ?? '—'}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-3 text-xs">
                    {shortCommit ? (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] text-fg">
                          {shortCommit}
                        </span>
                        {git?.subject && <span className="truncate text-dim">{git.subject}</span>}
                      </div>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="py-3 pl-2 pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id)}
                      className="rounded border border-line bg-ink px-2.5 py-1 text-xs text-fg hover:border-fg/40 hover:bg-panel"
                    >
                      {t('deployments.open')}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
