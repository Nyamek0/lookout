import type { ReactNode } from 'react'
import type { Status } from '../../shared/types'
import { Sidebar, type ServerEntry } from './Sidebar'

export function Shell({
  servers,
  activeId,
  isFleet,
  isSettings,
  fleetStatus,
  onSelectFleet,
  onSelect,
  onAdd,
  onOpenSettings,
  children
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
  children: ReactNode
}) {
  return (
    <div className="flex h-full">
      <Sidebar
        servers={servers}
        activeId={activeId}
        isFleet={isFleet}
        isSettings={isSettings}
        fleetStatus={fleetStatus}
        onSelectFleet={onSelectFleet}
        onSelect={onSelect}
        onAdd={onAdd}
        onOpenSettings={onOpenSettings}
      />
      <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
