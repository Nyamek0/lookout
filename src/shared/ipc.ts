import type { LogChunk, PreparedAction, ServerConfig, Snapshot, SshHost } from './types'

export interface NewServerInput extends Omit<ServerConfig, 'id'> {
  /** Passphrase or password: handed to the system keychain, never stored or sent back. */
  secret?: string
}

export interface HostKeyPromptInfo {
  promptId: string
  serverId: string
  fingerprint: string
}

export interface HostKeyChangedInfo {
  serverId: string
  expected: string
  actual: string
}

export type Unsubscribe = () => void

/** The whole surface the interface can call. `window.lookout` is exactly this. */
export interface LookoutApi {
  servers: {
    list(): Promise<ServerConfig[]>
    add(input: NewServerInput): Promise<ServerConfig>
    remove(id: string): Promise<void>
    importSshConfig(): Promise<SshHost[]>
  }
  monitor: {
    onSnapshot(cb: (snapshot: Snapshot) => void): Unsubscribe
    setActive(serverId: string): Promise<void>
    /** Polling pauses after a failed login or a refused/changed host key: this resumes it now. */
    retry(serverId: string): Promise<void>
  }
  hostKey: {
    onPrompt(cb: (prompt: HostKeyPromptInfo) => void): Unsubscribe
    onChanged(cb: (info: HostKeyChangedInfo) => void): Unsubscribe
    answer(promptId: string, accept: boolean): Promise<void>
    /** Forget the pinned key of a server (after a legitimate rebuild): the next connection asks again. */
    forget(serverId: string): Promise<void>
  }
  logs: {
    fetch(serverId: string, containerId: string, opts: { tail: number; until?: string }): Promise<LogChunk>
    follow(
      serverId: string,
      containerId: string,
      cb: (lines: string[]) => void,
      onEnd?: (reason?: string) => void
    ): Promise<Unsubscribe>
  }
  actions: {
    prepareRestart(serverId: string, containerIds: string[]): Promise<PreparedAction>
    confirm(actionId: string): Promise<{ ok: boolean; stderr: string }>
  }
  settings: {
    getLanguage(): Promise<'en' | 'fr'>
    setLanguage(language: 'en' | 'fr'): Promise<void>
  }
}

/** Request/response channels (ipcRenderer.invoke). Keep in step with the handlers: a test enforces it. */
export const INVOKE_CHANNELS = [
  'servers:list',
  'servers:add',
  'servers:remove',
  'servers:importSshConfig',
  'monitor:setActive',
  'monitor:retry',
  'hostKey:answer',
  'hostKey:forget',
  'logs:fetch',
  'logs:follow',
  'logs:unfollow',
  'actions:prepareRestart',
  'actions:confirm',
  'settings:getLanguage',
  'settings:setLanguage'
] as const
export type InvokeChannel = (typeof INVOKE_CHANNELS)[number]

/** Main → renderer events. */
export const EVENT_CHANNELS = {
  snapshot: 'monitor:snapshot',
  hostKeyPrompt: 'hostKey:prompt',
  hostKeyChanged: 'hostKey:changed',
  logLines: 'logs:lines',
  logEnded: 'logs:ended'
} as const
