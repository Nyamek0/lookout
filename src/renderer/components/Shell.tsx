import type { ReactNode } from 'react'
import { Sidebar, type ServerEntry } from './Sidebar'

export function Shell({
  servers,
  activeId,
  onSelect,
  onAdd,
  children
}: {
  servers: ServerEntry[]
  activeId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  children: ReactNode
}) {
  return (
    <div className="flex h-full">
      <Sidebar servers={servers} activeId={activeId} onSelect={onSelect} onAdd={onAdd} />
      <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
