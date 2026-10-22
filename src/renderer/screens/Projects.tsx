import { useTranslation } from 'react-i18next'
import type { Snapshot } from '../../shared/types'
import { StatusDot } from '../components/StatusDot'
import { formatBytes } from '../format'

export function Projects({ snapshot, onOpen }: { snapshot: Snapshot; onOpen: (projectId: string) => void }) {
  const { t } = useTranslation()
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t('projects.title')}</h1>
      {snapshot.projects.length === 0 ? (
        <p className="text-sm text-dim">{t('home.noProjects')}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {snapshot.projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p.id)}
              className="rounded-[10px] border border-line bg-panel p-4 text-left hover:border-dim"
            >
              <div className="flex items-center gap-2">
                <StatusDot status={p.status} />
                <span className="truncate font-medium">{p.name}</span>
              </div>
              <p className="mt-1 text-xs text-dim">{t(`kind.${p.kind}`)}</p>
              <div className="mt-3 flex flex-col gap-0.5 text-sm text-dim">
                {p.domains.map((d) => (
                  <span key={d.host} className="truncate">{d.host}</span>
                ))}
              </div>
              {p.kind !== 'static' && <p className="mt-3 text-sm">{formatBytes(p.usage.memBytes)}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
