import type { MonitorFocus, ServerConfig, Snapshot } from '../../shared/types'
import type { ServerMonitor } from './serverMonitor'

type Listener = (snapshot: Snapshot) => void

/** One monitor per server; only the selected one polls fast. */
export class MonitorManager {
  private readonly monitors = new Map<string, ServerMonitor>()
  private readonly listeners = new Set<Listener>()
  private focus: MonitorFocus = { kind: 'none' }

  constructor(private readonly factory: (server: ServerConfig) => ServerMonitor) {}

  onSnapshot(cb: Listener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  startAll(servers: ServerConfig[]): void {
    for (const server of servers) this.add(server)
  }

  add(server: ServerConfig): void {
    if (this.monitors.has(server.id)) return
    const monitor = this.factory(server)
    monitor.on('snapshot', (s: Snapshot) => this.listeners.forEach((cb) => cb(s)))
    this.monitors.set(server.id, monitor)
    this.applyFocusToMonitor(server.id, monitor)
    monitor.start()
  }

  retry(serverId: string): void {
    this.monitors.get(serverId)?.retry()
  }

  remove(serverId: string): void {
    this.monitors.get(serverId)?.stop()
    this.monitors.delete(serverId)
  }

  get(serverId: string): ServerMonitor | undefined {
    return this.monitors.get(serverId)
  }

  setFocus(focus: MonitorFocus): void {
    this.focus = focus
    for (const [id, monitor] of this.monitors) {
      this.applyFocusToMonitor(id, monitor)
    }
  }

  setActiveServer(serverId: string): void {
    this.setFocus({ kind: 'server', id: serverId })
  }

  latest(): Snapshot[] {
    const list: Snapshot[] = []
    for (const monitor of this.monitors.values()) {
      const snap = monitor.latest()
      if (snap) list.push(snap)
    }
    return list
  }

  private applyFocusToMonitor(id: string, monitor: ServerMonitor): void {
    if (this.focus.kind === 'server') {
      monitor.setMode(id === this.focus.id ? 'foreground' : 'background')
    } else if (this.focus.kind === 'fleet') {
      monitor.setMode('fleet')
    } else {
      monitor.setMode('background')
    }
  }

  stopAll(): void {
    this.monitors.forEach((m) => m.stop())
  }
}
