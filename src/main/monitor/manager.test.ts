import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { MonitorMode, ServerConfig, Snapshot } from '../../shared/types'
import { MonitorManager } from './manager'
import type { ServerMonitor } from './serverMonitor'

const server = (id: string): ServerConfig => ({ id, name: id, host: '1.1.1.1', port: 22, user: 'root', authType: 'agent' })

class FakeMonitor extends EventEmitter {
  mode: MonitorMode = 'background'
  active: boolean | null = null
  started = false
  stopped = false
  retried = 0
  snapshot: Snapshot | null = null

  retry() {
    this.retried++
  }
  setMode(m: MonitorMode) {
    this.mode = m
    this.active = m === 'foreground'
  }
  setActive(a: boolean) {
    this.setMode(a ? 'foreground' : 'background')
  }
  start() {
    this.started = true
  }
  stop() {
    this.stopped = true
  }
  latest(): Snapshot | null {
    return this.snapshot
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

  it('remembers the selected server even if its monitor does not exist yet', () => {
    const monitors = new Map<string, FakeMonitor>()
    const manager = new MonitorManager((s) => {
      const m = new FakeMonitor()
      monitors.set(s.id, m)
      return m as unknown as ServerMonitor
    })
    manager.setActiveServer('b') // the interface chose before the monitors were started
    manager.startAll([server('a'), server('b')])
    expect(monitors.get('b')!.active).toBe(true)
    expect(monitors.get('a')!.active).toBe(false)
  })

  it('asks a monitor to retry now', () => {
    const fake = new FakeMonitor()
    const manager = new MonitorManager(() => fake as unknown as ServerMonitor)
    manager.startAll([server('a')])
    manager.retry('a')
    manager.retry('nope')
    expect(fake.retried).toBe(1)
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

  it('switches modes based on focus: fleet, server, and none', () => {
    const monitors = new Map<string, FakeMonitor>()
    const manager = new MonitorManager((s) => {
      const m = new FakeMonitor()
      monitors.set(s.id, m)
      return m as unknown as ServerMonitor
    })
    manager.startAll([server('a'), server('b')])

    manager.setFocus({ kind: 'fleet' })
    expect(monitors.get('a')!.mode).toBe('fleet')
    expect(monitors.get('b')!.mode).toBe('fleet')

    manager.setFocus({ kind: 'server', id: 'a' })
    expect(monitors.get('a')!.mode).toBe('foreground')
    expect(monitors.get('b')!.mode).toBe('background')

    manager.setFocus({ kind: 'none' })
    expect(monitors.get('a')!.mode).toBe('background')
    expect(monitors.get('b')!.mode).toBe('background')
  })

  it('collects latest snapshots from monitors', () => {
    const monitors = new Map<string, FakeMonitor>()
    const manager = new MonitorManager((s) => {
      const m = new FakeMonitor()
      monitors.set(s.id, m)
      return m as unknown as ServerMonitor
    })
    manager.startAll([server('a'), server('b')])
    expect(manager.latest()).toEqual([])

    monitors.get('a')!.snapshot = { serverId: 'a' } as Snapshot
    expect(manager.latest()).toEqual([{ serverId: 'a' }])
  })
})
