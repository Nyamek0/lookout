import { useTranslation } from 'react-i18next'
import type { Status } from '../../shared/types'
import { StatusDot } from './StatusDot'

export interface ServerEntry {
  id: string
  name: string
  status: Status
}

export function Sidebar({
  servers,
  activeId,
  isFleet,
  isSettings,
  fleetStatus,
  onSelectFleet,
  onSelect,
  onAdd,
  onOpenSettings
}: {
  servers: ServerEntry[]
  activeId: string | null
  isFleet?: boolean
  isSettings?: boolean
  fleetStatus?: Status
  onSelectFleet?: () => void
  onSelect: (id: string) => void
  onAdd: () => void
  onOpenSettings?: () => void
}) {
  const { t } = useTranslation()
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-ink p-3">
      <h2 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-widest text-dim">{t('sidebar.servers')}</h2>
      <nav className="flex flex-1 flex-col gap-1 overflow-auto">
        {servers.length > 1 && onSelectFleet && (
          <button
            type="button"
            aria-current={isFleet ? 'true' : undefined}
            onClick={onSelectFleet}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel ${
              isFleet ? 'bg-panel text-fg' : 'text-dim'
            }`}
          >
            <StatusDot status={fleetStatus ?? 'neutral'} />
            <span className="truncate">{t('tray.fleet')}</span>
          </button>
        )}
        {servers.length === 0 && <p className="px-2 text-sm text-dim">{t('sidebar.empty')}</p>}
        {servers.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={!isFleet && !isSettings && s.id === activeId ? 'true' : undefined}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel ${
              !isFleet && !isSettings && s.id === activeId ? 'bg-panel text-fg' : 'text-dim'
            }`}
          >
            <StatusDot status={s.status} />
            <span className="truncate">{s.name}</span>
          </button>
        ))}
      </nav>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 rounded-md border border-line px-2 py-1.5 text-sm text-fg hover:bg-panel"
      >
        {t('sidebar.add')}
      </button>
      {onOpenSettings && (
        <div className="mt-3 border-t border-line pt-3">
          <button
            type="button"
            aria-current={isSettings ? 'true' : undefined}
            onClick={onOpenSettings}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel ${
              isSettings ? 'bg-panel text-fg' : 'text-dim'
            }`}
          >
            <span className="truncate">{t('sidebar.settings')}</span>
          </button>
        </div>
      )}
    </aside>
  )
}
