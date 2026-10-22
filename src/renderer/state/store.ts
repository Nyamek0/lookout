import { create } from 'zustand'
import type { ServerConfig, Snapshot } from '../../shared/types'

interface AppState {
  servers: ServerConfig[]
  snapshots: Record<string, Snapshot>
  activeId: string | null
  init(): Promise<() => void>
  refreshServers(): Promise<void>
  select(serverId: string): void
}

export const useAppStore = create<AppState>((set, get) => ({
  servers: [],
  snapshots: {},
  activeId: null,

  async init() {
    const off = window.lookout.monitor.onSnapshot((snapshot) =>
      set((s) => ({ snapshots: { ...s.snapshots, [snapshot.serverId]: snapshot } }))
    )
    await get().refreshServers()
    const first = get().servers[0]
    if (first && !get().activeId) get().select(first.id)
    return off
  },

  async refreshServers() {
    set({ servers: await window.lookout.servers.list() })
  },

  select(serverId) {
    set({ activeId: serverId })
    void window.lookout.monitor.setActive(serverId)
  }
}))
