import type { ServerConfig, Snapshot } from '../../shared/types'
import type { ServerMonitor } from './serverMonitor'

type Listener = (snapshot: Snapshot) => void

/** One monitor per server; only the selected one polls fast. */
export class MonitorManager {
  private readonly monitors = new Map<string, ServerMonitor>()
  private readonly listeners = new Set<Listener>()

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
    monitor.start()
  }

  remove(serverId: string): void {
    this.monitors.get(serverId)?.stop()
    this.monitors.delete(serverId)
  }

  get(serverId: string): ServerMonitor | undefined {
    return this.monitors.get(serverId)
  }

  setActiveServer(serverId: string): void {
    for (const [id, monitor] of this.monitors) monitor.setActive(id === serverId)
  }

  stopAll(): void {
    this.monitors.forEach((m) => m.stop())
  }
}
