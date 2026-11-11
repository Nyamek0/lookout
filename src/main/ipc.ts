import { randomUUID } from 'node:crypto'
import type { IpcMain } from 'electron'
import { EVENT_CHANNELS, INVOKE_CHANNELS, type InvokeChannel, type NewServerInput } from '../shared/ipc'
import type { MonitorFocus, Preferences, PreferencesPatch, ServerConfig, Snapshot, UpdateInfo } from '../shared/types'
import type { ActionService } from './actions/actions'
import { fetchLogs, followLogs, type LogFollows } from './logs/logs'
import type { Exec } from './ssh/connection'
import type { HostKeyPrompter } from './ssh/prompter'
import { parseSshConfig } from './ssh/sshConfig'
import type { SecretStore } from './store/secrets'
import type { ServerStore } from './store/serverStore'
import { checkForUpdates } from './updates/checker'

export interface IpcServices {
  serverStore: ServerStore
  secrets: SecretStore
  manager: {
    add(server: ServerConfig): void
    remove(serverId: string): void
    setFocus(focus: MonitorFocus): void
    setActiveServer(serverId: string): void
    latest(): Snapshot[]
    retry(serverId: string): void
  }
  /** Open live log subscriptions, closed when their server goes away or the window reloads. */
  follows: LogFollows
  /** Drops the pinned host key of a server so the next connection asks the user again. */
  forgetHostKey(serverId: string): void
  actions: ActionService
  execFor(serverId: string): Exec
  readSshConfig(): { text: string; include?: (pattern: string) => string[] }
  settings: {
    get(): Preferences
    update(patch: PreferencesPatch): Preferences
    getLanguage(): Promise<'en' | 'fr'>
    setLanguage(language: 'en' | 'fr'): Promise<void>
  }
  showTestNotification?: () => void
  appVersion?: string
  checkForUpdates?: () => Promise<UpdateInfo>
  openReleasePage?: (url: string) => Promise<void>
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
function monitorFocus(v: unknown): MonitorFocus {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new TypeError('focus must be an object')
  }
  const o = v as Record<string, unknown>
  if (o['kind'] === 'server') {
    return { kind: 'server', id: str(o['id'], 'id') }
  }
  if (o['kind'] === 'fleet') {
    return { kind: 'fleet' }
  }
  if (o['kind'] === 'none') {
    return { kind: 'none' }
  }
  throw new TypeError('invalid focus kind')
}

const AUTH_TYPES = ['agent', 'key', 'password']


const ALLOWED_PREF_KEYS = new Set(['language', 'notifications', 'keepInTray'])
const ALLOWED_NOTIF_KEYS = new Set(['enabled', 'warnings', 'recoveries'])

function preferencesPatch(v: unknown): PreferencesPatch {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new TypeError('preferences patch must be an object')
  }
  const o = v as Record<string, unknown>
  for (const k of Object.keys(o)) {
    if (!ALLOWED_PREF_KEYS.has(k)) throw new TypeError(`unknown preference ${k}`)
  }
  const patch: PreferencesPatch = {}
  if ('language' in o) {
    if (o['language'] !== 'en' && o['language'] !== 'fr') throw new TypeError('language must be en or fr')
    patch.language = o['language']
  }
  if ('keepInTray' in o) {
    if (typeof o['keepInTray'] !== 'boolean') throw new TypeError('keepInTray must be a boolean')
    patch.keepInTray = o['keepInTray']
  }
  if ('notifications' in o) {
    const n = o['notifications']
    if (typeof n !== 'object' || n === null || Array.isArray(n)) {
      throw new TypeError('notifications must be an object')
    }
    const no = n as Record<string, unknown>
    for (const k of Object.keys(no)) {
      if (!ALLOWED_NOTIF_KEYS.has(k)) throw new TypeError(`unknown notification preference ${k}`)
    }
    const notifs: PreferencesPatch['notifications'] = {}
    for (const k of ALLOWED_NOTIF_KEYS) {
      if (k in no) {
        if (typeof no[k] !== 'boolean') throw new TypeError(`${k} must be a boolean`)
        ;(notifs as Record<string, boolean>)[k] = no[k] as boolean
      }
    }
    patch.notifications = notifs
  }
  return patch
}

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
      if (secret) {
        try {
          await s.secrets.set(server.id, secret)
        } catch (e) {
          s.serverStore.remove(server.id) // never keep a server that has no way to sign in
          throw e
        }
      }
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
    'monitor:setFocus': async (focus) => s.manager.setFocus(monitorFocus(focus)),
    'monitor:latest': async () => s.manager.latest(),
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
    'settings:get': async () => s.settings.get(),
    'settings:update': async (patch) => s.settings.update(preferencesPatch(patch)),
    'settings:getLanguage': async () => s.settings.getLanguage(),
    'settings:setLanguage': async (language) => s.settings.setLanguage(language === 'fr' ? 'fr' : 'en'),
    'settings:testNotification': async () => {
      s.showTestNotification?.()
    },
    'updates:check': async () => {
      if (s.checkForUpdates) return s.checkForUpdates()
      return checkForUpdates({ currentVersion: s.appVersion ?? '0.0.0' })
    },
    'updates:openReleasePage': async (url) => {
      const target =
        typeof url === 'string' && url.startsWith('https://github.com/Nyamek0/lookout/releases')
          ? url
          : 'https://github.com/Nyamek0/lookout/releases'
      await s.openReleasePage?.(target)
    }
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
