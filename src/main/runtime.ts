import { lookup } from 'node:dns/promises'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { EVENT_CHANNELS } from '../shared/ipc'
import type { ServerConfig } from '../shared/types'
import { ActionService } from './actions/actions'
import { defaultDomainDeps } from './collect/domains'
import type { IpcServices } from './ipc'
import { MonitorManager } from './monitor/manager'
import { ServerMonitor } from './monitor/serverMonitor'
import { PathRegistry } from './security/pathRegistry'
import { authFor } from './ssh/auth'
import { SshConnection, type Exec } from './ssh/connection'
import { HostKeyChangedError, KnownHosts } from './ssh/hostKeys'
import { HostKeyPrompter } from './ssh/prompter'
import { KeyringSecretStore, type SecretStore } from './store/secrets'
import { ServerStore } from './store/serverStore'
import { SettingsStore } from './store/settings'

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/** Include patterns of ~/.ssh/config: relative to ~/.ssh, with a simple `*` wildcard in the file name. */
function readIncluded(sshDir: string, pattern: string): string[] {
  const full = pattern.startsWith('~') ? homedir() + pattern.slice(1) : isAbsolute(pattern) ? pattern : join(sshDir, pattern)
  const dir = dirname(full)
  const name = full.slice(dir.length + 1)
  if (!existsSync(dir)) return []
  const matcher = new RegExp(`^${name.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`)
  return readdirSync(dir)
    .filter((f) => matcher.test(f))
    .map((f) => resolve(dir, f))
    .flatMap((f) => {
      try {
        return [readFileSync(f, 'utf8')]
      } catch {
        return []
      }
    })
}

/** Builds every long-lived service of the main process and wires them together. */
export function createRuntime(o: {
  userData: string
  send: (channel: string, payload: unknown) => void
  /** Defaults to the OS keychain; the demo mode swaps in an in-memory store. */
  secrets?: SecretStore
}) {
  const serverStore = new ServerStore(join(o.userData, 'servers.json'))
  const knownHosts = new KnownHosts(join(o.userData, 'known_hosts.json'))
  const secrets: SecretStore = o.secrets ?? new KeyringSecretStore()
  const settings = new SettingsStore(join(o.userData, 'settings.json'))
  const prompter = new HostKeyPrompter((p) => o.send(EVENT_CHANNELS.hostKeyPrompt, p))

  const connections = new Map<string, SshConnection>()
  const execs = new Map<string, Exec>()

  const execFor = (serverId: string): Exec => {
    const existing = execs.get(serverId)
    if (existing) return existing
    const server = serverStore.list().find((s) => s.id === serverId)
    if (!server) throw new Error(`unknown server ${serverId}`)

    const connection = new SshConnection({
      host: server.host,
      port: server.port,
      user: server.user,
      auth: async () => authFor(server, await secrets.get(server.id)),
      knownHosts,
      onUnknownHost: (fingerprint) => prompter.ask(server.id, fingerprint)
    })
    const report = (e: unknown): never => {
      if (e instanceof HostKeyChangedError) {
        o.send(EVENT_CHANNELS.hostKeyChanged, { serverId, expected: e.expected, actual: e.actual })
      }
      throw e
    }
    const exec: Exec = {
      exec: (argv, opts) => connection.exec(argv, opts).catch(report),
      stream: (argv, onData) => connection.stream(argv, onData)
    }
    connections.set(serverId, connection)
    execs.set(serverId, exec)
    return exec
  }

  const manager = new MonitorManager((server: ServerConfig) => {
    const known = IPV4.test(server.host)
    const monitor = new ServerMonitor({
      serverId: server.id,
      exec: execFor(server.id),
      serverIp: known ? server.host : '',
      deps: defaultDomainDeps
    })
    if (!known) {
      lookup(server.host, { family: 4 })
        .then((r) => monitor.setServerIp(r.address))
        .catch(() => {})
    }
    return monitor
  })
  manager.onSnapshot((snapshot) => o.send(EVENT_CHANNELS.snapshot, snapshot))

  const actions = new ActionService(execFor, (id) => manager.get(id)?.paths ?? new PathRegistry())

  const services: IpcServices = {
    serverStore,
    secrets,
    manager: {
      add: (s) => manager.add(s),
      remove: (id) => {
        manager.remove(id)
        connections.get(id)?.close()
        connections.delete(id)
        execs.delete(id)
      },
      setActiveServer: (id) => manager.setActiveServer(id)
    },
    actions,
    execFor,
    readSshConfig: () => {
      const sshDir = join(homedir(), '.ssh')
      const file = join(sshDir, 'config')
      return {
        text: existsSync(file) ? readFileSync(file, 'utf8') : '',
        include: (pattern) => readIncluded(sshDir, pattern)
      }
    },
    settings,
    prompter,
    emit: o.send
  }

  return {
    services,
    start: () => manager.startAll(serverStore.list()),
    stop: () => {
      manager.stopAll()
      connections.forEach((c) => c.close())
    }
  }
}
