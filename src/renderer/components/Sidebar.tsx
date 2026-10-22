import { useTranslation } from 'react-i18next'
import type { Status } from '../../shared/types'
import { LanguageSwitch } from './LanguageSwitch'
import { StatusDot } from './StatusDot'

export interface ServerEntry {
  id: string
  name: string
  status: Status
}

export function Sidebar({
  servers,
  activeId,
  onSelect,
  onAdd
}: {
  servers: ServerEntry[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-line bg-ink p-3">
      <h2 className="mb-2 px-2 text-[11px] font-medium uppercase tracking-widest text-dim">{t('sidebar.servers')}</h2>
      <nav className="flex flex-1 flex-col gap-1 overflow-auto">
        {servers.length === 0 && <p className="px-2 text-sm text-dim">{t('sidebar.empty')}</p>}
        {servers.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-current={s.id === activeId ? 'true' : undefined}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel ${
              s.id === activeId ? 'bg-panel text-fg' : 'text-dim'
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
      <div className="mt-3 border-t border-line pt-3">
        <LanguageSwitch />
      </div>
    </aside>
  )
}
