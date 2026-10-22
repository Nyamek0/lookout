import { contextBridge, ipcRenderer } from 'electron'
import {
  EVENT_CHANNELS,
  type HostKeyChangedInfo,
  type HostKeyPromptInfo,
  type InvokeChannel,
  type LookoutApi
} from '../shared/ipc'
import type { Snapshot } from '../shared/types'

const invoke = <T>(channel: InvokeChannel, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args) as Promise<T>

function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// The only thing the interface can reach: no node, no fs, no raw ipcRenderer.
const api: LookoutApi = {
  servers: {
    list: () => invoke('servers:list'),
    add: (input) => invoke('servers:add', input),
    remove: (id) => invoke('servers:remove', id),
    importSshConfig: () => invoke('servers:importSshConfig')
  },
  monitor: {
    onSnapshot: (cb) => on<Snapshot>(EVENT_CHANNELS.snapshot, cb),
    setActive: (serverId) => invoke('monitor:setActive', serverId),
    retry: (serverId) => invoke('monitor:retry', serverId)
  },
  hostKey: {
    onPrompt: (cb) => on<HostKeyPromptInfo>(EVENT_CHANNELS.hostKeyPrompt, cb),
    onChanged: (cb) => on<HostKeyChangedInfo>(EVENT_CHANNELS.hostKeyChanged, cb),
    answer: (promptId, accept) => invoke('hostKey:answer', promptId, accept),
    forget: (serverId) => invoke('hostKey:forget', serverId)
  },
  logs: {
    fetch: (serverId, containerId, opts) => invoke('logs:fetch', serverId, containerId, opts),
    follow: async (serverId, containerId, cb, onEnd) => {
      // Subscribe before asking, so a line or an end notice that arrives straight away is not missed.
      let subId: string | null = null
      const early: { lines?: string[][]; ended?: { reason?: string } } = {}
      const offLines = on<{ subId: string; lines: string[] }>(EVENT_CHANNELS.logLines, (p) => {
        if (subId === null) (early.lines ??= []).push(p.lines)
        else if (p.subId === subId) cb(p.lines)
      })
      const offEnd = on<{ subId: string; reason?: string }>(EVENT_CHANNELS.logEnded, (p) => {
        if (subId !== null && p.subId === subId) onEnd?.(p.reason)
      })
      subId = await invoke<string>('logs:follow', serverId, containerId)
      early.lines?.forEach(cb)
      return () => {
        offLines()
        offEnd()
        void invoke('logs:unfollow', subId)
      }
    }
  },
  actions: {
    prepareRestart: (serverId, containerIds) => invoke('actions:prepareRestart', serverId, containerIds),
    confirm: (actionId) => invoke('actions:confirm', actionId)
  },
  settings: {
    getLanguage: () => invoke('settings:getLanguage'),
    setLanguage: (language) => invoke('settings:setLanguage', language)
  }
}

contextBridge.exposeInMainWorld('lookout', api)
