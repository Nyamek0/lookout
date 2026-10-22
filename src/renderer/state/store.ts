import { create } from 'zustand'
import type { ServerConfig, Snapshot } from '../../shared/types'

const HISTORY_POINTS = 60

interface AppState {
  servers: ServerConfig[]
  snapshots: Record<string, Snapshot>
  /** Rolling cpu/memory per project (`serverId:projectId`), drawn as small curves. */
  projectHistory: Record<string, { cpu: number[]; mem: number[] }>
  activeId: string | null
  init(): Promise<() => void>
  refreshServers(): Promise<void>
  select(serverId: string): void
}

const push = (values: number[], value: number): number[] => [...values, value].slice(-HISTORY_POINTS)

export const useAppStore = create<AppState>((set, get) => ({
  servers: [],
  snapshots: {},
  projectHistory: {},
  activeId: null,

  async init() {
    const off = window.lookout.monitor.onSnapshot((snapshot) =>
      set((s) => {
        const projectHistory = { ...s.projectHistory }
        for (const p of snapshot.projects) {
          const key = `${snapshot.serverId}:${p.id}`
          const prev = projectHistory[key] ?? { cpu: [], mem: [] }
          projectHistory[key] = { cpu: push(prev.cpu, p.usage.cpuPercent), mem: push(prev.mem, p.usage.memBytes) }
        }
        return { snapshots: { ...s.snapshots, [snapshot.serverId]: snapshot }, projectHistory }
      })
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
