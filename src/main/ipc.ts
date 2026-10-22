import { randomUUID } from 'node:crypto'
import type { IpcMain } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, type InvokeChannel, type NewServerInput } from '../shared/ipc'
import type { ServerConfig } from '../shared/types'
import type { ActionService } from './actions/actions'
import { fetchLogs, followLogs } from './logs/logs'
import type { Exec } from './ssh/connection'
import type { HostKeyPrompter } from './ssh/prompter'
import { parseSshConfig } from './ssh/sshConfig'
import type { SecretStore } from './store/secrets'
import type { ServerStore } from './store/serverStore'

export interface IpcServices {
  serverStore: ServerStore
  secrets: SecretStore
  manager: { add(server: ServerConfig): void; remove(serverId: string): void; setActiveServer(serverId: string): void }
  actions: ActionService
  execFor(serverId: string): Exec
  readSshConfig(): { text: string; include?: (pattern: string) => string[] }
  settings: { getLanguage(): Promise<'en' | 'fr'>; setLanguage(language: 'en' | 'fr'): Promise<void> }
  prompter: HostKeyPrompter
  emit(channel: string, payload: unknown): void
}

type Handler = (...args: unknown[]) => Promise<unknown>

const str = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || v.length === 0) throw new TypeError(`${name} must be a non-empty string`)
  return v
}
const strings = (v: unknown, name: string): string[] => {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) throw new TypeError(`${name} must be an array of strings`)
  return v as string[]
}
const AUTH_TYPES = ['agent', 'key', 'password']

function newServer(v: unknown): NewServerInput {
  if (typeof v !== 'object' || v === null) throw new TypeError('server must be an object')
  const o = v as Record<string, unknown>
  const port = o['port']
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw new TypeError('port must be 1-65535')
  if (!AUTH_TYPES.includes(o['authType'] as string)) throw new TypeError('authType must be agent, key or password')
  return {
    name: str(o['name'], 'name'),
    host: str(o['host'], 'host'),
    port,
    user: str(o['user'], 'user'),
    authType: o['authType'] as NewServerInput['authType'],
    ...(o['keyPath'] ? { keyPath: str(o['keyPath'], 'keyPath') } : {}),
    ...(o['secret'] ? { secret: str(o['secret'], 'secret') } : {})
  }
}

export function createHandlers(s: IpcServices): Record<InvokeChannel, Handler> {
  const follows = new Map<string, { stop(): void }>()

  return {
    'servers:list': async () => s.serverStore.list(),
    'servers:add': async (input) => {
      const { secret, ...config } = newServer(input)
      const server = s.serverStore.add(config)
      if (secret) await s.secrets.set(server.id, secret)
      s.manager.add(server)
      return server
    },
    'servers:remove': async (id) => {
      const serverId = str(id, 'id')
      s.manager.remove(serverId)
      s.serverStore.remove(serverId)
      await s.secrets.delete(serverId)
    },
    'servers:importSshConfig': async () => {
      const { text, include } = s.readSshConfig()
      return parseSshConfig(text, include)
    },
    'monitor:setActive': async (id) => s.manager.setActiveServer(str(id, 'serverId')),
    'hostKey:answer': async (promptId, accept) => s.prompter.answer(str(promptId, 'promptId'), accept === true),
    'logs:fetch': async (serverId, containerId, opts) => {
      const o = (opts ?? {}) as { tail?: unknown; until?: unknown }
      if (typeof o.tail !== 'number') throw new TypeError('tail must be a number')
      return fetchLogs(s.execFor(str(serverId, 'serverId')), str(containerId, 'containerId'), {
        tail: o.tail,
        until: typeof o.until === 'string' ? o.until : undefined
      })
    },
    'logs:follow': async (serverId, containerId) => {
      const subId = randomUUID()
      const handle = followLogs(s.execFor(str(serverId, 'serverId')), str(containerId, 'containerId'), (lines) =>
        s.emit(EVENT_CHANNELS.logLines, { subId, lines })
      )
      follows.set(subId, handle)
      return subId
    },
    'logs:unfollow': async (subId) => {
      const id = str(subId, 'subId')
      follows.get(id)?.stop()
      follows.delete(id)
    },
    'actions:prepareRestart': async (serverId, ids) =>
      s.actions.prepareRestart(str(serverId, 'serverId'), strings(ids, 'containerIds')),
    'actions:confirm': async (actionId) => {
      try {
        return await s.actions.confirm(str(actionId, 'actionId'))
      } catch (e) {
        return { ok: false, stderr: e instanceof Error ? e.message : String(e) }
      }
    },
    'settings:getLanguage': async () => s.settings.getLanguage(),
    'settings:setLanguage': async (language) => s.settings.setLanguage(language === 'fr' ? 'fr' : 'en')
  }
}

export function registerIpc(ipcMain: Pick<IpcMain, 'handle'>, handlers: Record<InvokeChannel, Handler>): void {
  for (const channel of INVOKE_CHANNELS) ipcMain.handle(channel, (_event, ...args) => handlers[channel](...args))
}
