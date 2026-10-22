import { randomUUID } from 'node:crypto'
import type { IpcMain } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, type InvokeChannel, type NewServerInput } from '../shared/ipc'
import type { ServerConfig } from '../shared/types'
import type { ActionService } from './actions/actions'
import { fetchLogs, followLogs, type LogFollows } from './logs/logs'
import type { Exec } from './ssh/connection'
import type { HostKeyPrompter } from './ssh/prompter'
import { parseSshConfig } from './ssh/sshConfig'
import type { SecretStore } from './store/secrets'
import type { ServerStore } from './store/serverStore'

export interface IpcServices {
  serverStore: ServerStore
  secrets: SecretStore
  manager: {
    add(server: ServerConfig): void
    remove(serverId: string): void
    setActiveServer(serverId: string): void
    retry(serverId: string): void
  }
  /** Open live log subscriptions, closed when their server goes away or the window reloads. */
  follows: LogFollows
  /** Drops the pinned host key of a server so the next connection asks the user again. */
  forgetHostKey(serverId: string): void
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
      s.follows.stopServer(serverId)
      s.forgetHostKey(serverId) // while the server is still in the store, so its address can be found
      s.serverStore.remove(serverId)
      await s.secrets.delete(serverId)
    },
    'servers:importSshConfig': async () => {
      const { text, include } = s.readSshConfig()
      return parseSshConfig(text, include)
    },
    'monitor:setActive': async (id) => s.manager.setActiveServer(str(id, 'serverId')),
    'monitor:retry': async (id) => s.manager.retry(str(id, 'serverId')),
    'hostKey:answer': async (promptId, accept) => s.prompter.answer(str(promptId, 'promptId'), accept === true),
    'hostKey:forget': async (id) => s.forgetHostKey(str(id, 'serverId')),
    'logs:fetch': async (serverId, containerId, opts) => {
      const o = (opts ?? {}) as { tail?: unknown; until?: unknown }
      if (typeof o.tail !== 'number') throw new TypeError('tail must be a number')
      return fetchLogs(s.execFor(str(serverId, 'serverId')), str(containerId, 'containerId'), {
        tail: o.tail,
        until: typeof o.until === 'string' ? o.until : undefined
      })
    },
    'logs:follow': async (serverId, containerId) => {
      const server = str(serverId, 'serverId')
      const subId = randomUUID()
      const handle = followLogs(
        s.execFor(server),
        str(containerId, 'containerId'),
        (lines) => s.emit(EVENT_CHANNELS.logLines, { subId, lines }),
        (reason) => {
          s.follows.stop(subId)
          s.emit(EVENT_CHANNELS.logEnded, { subId, reason })
        }
      )
      s.follows.add(subId, server, handle)
      return subId
    },
    'logs:unfollow': async (subId) => s.follows.stop(str(subId, 'subId')),
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

/** Every call must come from the app's own page: a page the window was tricked into showing gets nothing. */
export function registerIpc(
  ipcMain: Pick<IpcMain, 'handle'>,
  handlers: Record<InvokeChannel, Handler>,
  isTrusted: (url: string | undefined) => boolean
): void {
  for (const channel of INVOKE_CHANNELS) {
    ipcMain.handle(channel, async (event, ...args) => {
      if (!isTrusted(event.senderFrame?.url)) throw new Error('untrusted sender')
      return handlers[channel](...args)
    })
  }
}
