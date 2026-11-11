import { create } from 'zustand'
import {
  DEFAULT_PREFERENCES,
  type MonitorFocus,
  type Preferences,
  type PreferencesPatch,
  type ServerConfig,
  type Snapshot
} from '../../shared/types'

const HISTORY_POINTS = 60

interface AppState {
  servers: ServerConfig[]
  snapshots: Record<string, Snapshot>
  /** Rolling cpu/memory per project (`serverId:projectId`), drawn as small curves. */
  projectHistory: Record<string, { cpu: number[]; mem: number[] }>
  activeId: string | null
  focus: MonitorFocus
  preferences: Preferences
  init(): Promise<() => void>
  refreshServers(): Promise<void>
  select(serverId: string): void
  setFocus(focus: MonitorFocus): void
  updatePreferences(patch: PreferencesPatch): Promise<void>
  removeServer(serverId: string): Promise<void>
}

const push = (values: number[], value: number): number[] => [...values, value].slice(-HISTORY_POINTS)

function recordProjectHistory(
  current: Record<string, { cpu: number[]; mem: number[] }>,
  snapshot: Snapshot
): Record<string, { cpu: number[]; mem: number[] }> {
  const projectHistory = { ...current }
  for (const p of snapshot.projects) {
    const key = `${snapshot.serverId}:${p.id}`
    const prev = projectHistory[key] ?? { cpu: [], mem: [] }
    projectHistory[key] = { cpu: push(prev.cpu, p.usage.cpuPercent), mem: push(prev.mem, p.usage.memBytes) }
  }
  return projectHistory
}

export const useAppStore = create<AppState>((set, get) => ({
  servers: [],
  snapshots: {},
  projectHistory: {},
  activeId: null,
  focus: { kind: 'none' },
  preferences: DEFAULT_PREFERENCES,

  async init() {
    let initialSnapshots: Snapshot[] = []
    try {
      initialSnapshots = (await window.lookout.monitor.latest?.()) ?? []
    } catch {
      // ignore
    }

    let initialPrefs: Preferences = DEFAULT_PREFERENCES
    try {
      initialPrefs = (await window.lookout.settings.get?.()) ?? DEFAULT_PREFERENCES
    } catch {
      // ignore
    }

    let projectHistory = get().projectHistory
    const snapshots: Record<string, Snapshot> = { ...get().snapshots }
    for (const snap of initialSnapshots) {
      snapshots[snap.serverId] = snap
      projectHistory = recordProjectHistory(projectHistory, snap)
    }

    set({ snapshots, projectHistory, preferences: initialPrefs })

    const off = window.lookout.monitor.onSnapshot((snapshot) =>
      set((s) => ({
        snapshots: { ...s.snapshots, [snapshot.serverId]: snapshot },
        projectHistory: recordProjectHistory(s.projectHistory, snapshot)
      }))
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
    get().setFocus({ kind: 'server', id: serverId })
  },

  setFocus(focus) {
    set({ focus })
    void window.lookout.monitor.setFocus?.(focus)
    if (focus.kind === 'server') {
      void window.lookout.monitor.setActive?.(focus.id)
    }
  },

  async updatePreferences(patch) {
    const updated = await window.lookout.settings.update(patch)
    set({ preferences: updated })
  },

  async removeServer(serverId) {
    await window.lookout.servers.remove(serverId)
    await get().refreshServers()
    set((s) => ({
      snapshots: Object.fromEntries(Object.entries(s.snapshots).filter(([id]) => id !== serverId)),
      activeId: s.activeId === serverId ? null : s.activeId
    }))
    const next = get().servers[0]
    if (!get().activeId && next) get().select(next.id)
  }
}))
