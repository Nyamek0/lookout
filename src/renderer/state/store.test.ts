// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LookoutApi } from '../../shared/ipc'
import type { ServerConfig, Snapshot } from '../../shared/types'
import { useAppStore } from './store'

const server = (id: string): ServerConfig => ({ id, name: id, host: 'h', port: 22, user: 'u', authType: 'agent' })
const snap = (serverId: string, status: Snapshot['status']): Snapshot => ({
  serverId, takenAt: 1, reachable: true, host: null, history: { cpu: [], mem: [] },
  projects: [], containers: [], undetected: [], warnings: [], status
})

function installApi(servers: ServerConfig[]) {
  let push: (s: Snapshot) => void = () => {}
  const setActive = vi.fn(async () => {})
  window.lookout = {
    servers: { list: async () => servers },
    monitor: { onSnapshot: (cb: (s: Snapshot) => void) => ((push = cb), () => {}), setActive }
  } as unknown as LookoutApi
  return { push: (s: Snapshot) => push(s), setActive }
}

describe('app store', () => {
  beforeEach(() => useAppStore.setState({ servers: [], snapshots: {}, activeId: null, projectHistory: {} }))

  it('loads servers, selects the first and tells the main process', async () => {
    const api = installApi([server('a'), server('b')])
    await useAppStore.getState().init()
    expect(useAppStore.getState().activeId).toBe('a')
    expect(api.setActive).toHaveBeenCalledWith('a')
  })

  it('stores incoming snapshots by server', async () => {
    const api = installApi([server('a')])
    await useAppStore.getState().init()
    api.push(snap('a', 'warn'))
    expect(useAppStore.getState().snapshots['a']?.status).toBe('warn')
  })

  it('switches the active server', async () => {
    const api = installApi([server('a'), server('b')])
    await useAppStore.getState().init()
    useAppStore.getState().select('b')
    expect(useAppStore.getState().activeId).toBe('b')
    expect(api.setActive).toHaveBeenLastCalledWith('b')
  })

  it('keeps a short rolling history of each project to draw its curves', async () => {
    const api = installApi([server('a')])
    await useAppStore.getState().init()
    const withProject = (cpu: number, mem: number): Snapshot => ({
      ...snap('a', 'ok'),
      projects: [{
        id: 'p', name: 'p', kind: 'compose', containerIds: [], domains: [], git: null, deployMethod: 'file-copy',
        diskBytes: null, usage: { cpuPercent: cpu, memBytes: mem }, status: 'ok'
      }]
    })
    for (let i = 0; i < 70; i++) api.push(withProject(i, i * 10))
    const h = useAppStore.getState().projectHistory['a:p']!
    expect(h.cpu).toHaveLength(60)
    expect(h.cpu.at(-1)).toBe(69)
    expect(h.mem.at(-1)).toBe(690)
  })

  it('removes a server, drops its data and moves to the next one (or to none)', async () => {
    const api = installApi([server('a'), server('b')])
    const remove = vi.fn(async (id: string) => {
      const i = list.findIndex((s) => s.id === id)
      list.splice(i, 1)
    })
    const list = [server('a'), server('b')]
    window.lookout = {
      ...window.lookout,
      servers: { list: async () => [...list], remove }
    } as unknown as LookoutApi
    await useAppStore.getState().init()
    api.push(snap('a', 'ok'))
    await useAppStore.getState().removeServer('a')
    expect(remove).toHaveBeenCalledWith('a')
    expect(useAppStore.getState().servers.map((s) => s.id)).toEqual(['b'])
    expect(useAppStore.getState().snapshots['a']).toBeUndefined()
    expect(useAppStore.getState().activeId).toBe('b')
    await useAppStore.getState().removeServer('b')
    expect(useAppStore.getState().activeId).toBeNull()
  })

  it('works with no server yet', async () => {
    installApi([])
    await useAppStore.getState().init()
    expect(useAppStore.getState().activeId).toBeNull()
  })
})
