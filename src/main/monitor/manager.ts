import type { ServerConfig, Snapshot } from '../../shared/types'
import type { ServerMonitor } from './serverMonitor'

type Listener = (snapshot: Snapshot) => void

/** One monitor per server; only the selected one polls fast. */
export class MonitorManager {
  private readonly monitors = new Map<string, ServerMonitor>()
  private readonly listeners = new Set<Listener>()
  private activeId: string | null = null

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
    monitor.setActive(server.id === this.activeId) // the interface may have chosen before this monitor existed
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

  setActiveServer(serverId: string): void {
    this.activeId = serverId
    for (const [id, monitor] of this.monitors) monitor.setActive(id === serverId)
  }

  stopAll(): void {
    this.monitors.forEach((m) => m.stop())
  }
}
