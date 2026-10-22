import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { ServerConfig, Snapshot } from '../../shared/types'
import { MonitorManager } from './manager'
import type { ServerMonitor } from './serverMonitor'

const server = (id: string): ServerConfig => ({ id, name: id, host: '1.1.1.1', port: 22, user: 'root', authType: 'agent' })

class FakeMonitor extends EventEmitter {
  active: boolean | null = null
  started = false
  stopped = false
  setActive(a: boolean) {
    this.active = a
  }
  start() {
    this.started = true
  }
  stop() {
    this.stopped = true
  }
}

describe('MonitorManager', () => {
  it('starts every server and makes only the selected one active', () => {
    const monitors = new Map<string, FakeMonitor>()
    const manager = new MonitorManager((s) => {
      const m = new FakeMonitor()
      monitors.set(s.id, m)
      return m as unknown as ServerMonitor
    })
    manager.startAll([server('a'), server('b')])
    manager.setActiveServer('b')
    expect(monitors.get('a')!.started).toBe(true)
    expect(monitors.get('a')!.active).toBe(false)
    expect(monitors.get('b')!.active).toBe(true)
    manager.stopAll()
    expect(monitors.get('a')!.stopped && monitors.get('b')!.stopped).toBe(true)
  })

  it('forwards snapshots to listeners', () => {
    const fake = new FakeMonitor()
    const manager = new MonitorManager(() => fake as unknown as ServerMonitor)
    const cb = vi.fn()
    manager.onSnapshot(cb)
    manager.startAll([server('a')])
    const snap = { serverId: 'a' } as Snapshot
    fake.emit('snapshot', snap)
    expect(cb).toHaveBeenCalledWith(snap)
  })
})
