import { lookup } from 'node:dns/promises'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { Menu, nativeImage, Notification, Tray } from 'electron'
import { fleetSummary } from '../shared/fleet'
import { EVENT_CHANNELS } from '../shared/ipc'
import type { ServerConfig, Snapshot } from '../shared/types'
import { ActionService } from './actions/actions'
import { AlertTracker } from './alerts/alerts'
import { defaultDomainDeps } from './collect/domains'
import { createMainI18n } from './i18n'
import type { IpcServices } from './ipc'
import { LogFollows } from './logs/logs'
import { MonitorManager } from './monitor/manager'
import { ServerMonitor } from './monitor/serverMonitor'
import { Notifier } from './notify/notifier'
import { PathRegistry } from './security/pathRegistry'
import { authFor } from './ssh/auth'
import { SshConnection, type Exec } from './ssh/connection'
import { HostKeyChangedError, KnownHosts } from './ssh/hostKeys'
import { HostKeyPrompter } from './ssh/prompter'
import { KeyringSecretStore, type SecretStore } from './store/secrets'
import { ServerStore } from './store/serverStore'
import { SettingsStore } from './store/settings'
import { TrayController } from './tray/controller'
import { dotBitmap } from './tray/icon'

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
  showNotification?: (options: { title: string; body: string; silent?: boolean; onClick?: () => void }) => void
  focusWindow?: () => void
  quitApp?: () => void
  trayController?: TrayController
}) {
  const serverStore = new ServerStore(join(o.userData, 'servers.json'))
  const knownHosts = new KnownHosts(join(o.userData, 'known_hosts.json'))
  const secrets: SecretStore = o.secrets ?? new KeyringSecretStore()
  const settings = new SettingsStore(join(o.userData, 'settings.json'))
  const prompter = new HostKeyPrompter((p) => o.send(EVENT_CHANNELS.hostKeyPrompt, p))
  const i18n = createMainI18n(settings)
  const tracker = new AlertTracker()

  const defaultShow = (opts: { title: string; body: string; silent?: boolean; onClick?: () => void }) => {
    try {
      if (!Notification.isSupported()) return
      const n = new Notification({ title: opts.title, body: opts.body, silent: opts.silent })
      if (opts.onClick) n.on('click', opts.onClick)
      n.show()
    } catch {
      // ignore notification errors (e.g. in test environments without display)
    }
  }

  const notifier = new Notifier({
    show: o.showNotification ?? defaultShow,
    t: (key, opts) => i18n.t(key, opts),
    onNavigate: (target) => {
      o.focusWindow?.()
      o.send(EVENT_CHANNELS.navigate, target)
    },
    getServerName: (id) => serverStore.list().find((s) => s.id === id)?.name ?? id
  })

  let trayController = o.trayController
  if (!trayController) {
    try {
      const icon = nativeImage.createFromBitmap(dotBitmap('neutral', 16), { width: 16, height: 16 })
      const tray = new Tray(icon)
      trayController = new TrayController({
        tray,
        createIcon: (st) => nativeImage.createFromBitmap(dotBitmap(st, 16), { width: 16, height: 16 }),
        buildMenu: (items, onAction) => {
          const template = items.map((it) => {
            if (it.type === 'separator') return { type: 'separator' as const }
            return {
              label: it.label,
              enabled: it.enabled !== false,
              click: () => (it.id ? onAction(it.id) : undefined)
            }
          })
          return Menu.buildFromTemplate(template)
        },
        t: (k, opts) => i18n.t(k, opts),
        onAction: (act) => {
          o.focusWindow?.()
          if (act.id === 'quit') {
            o.quitApp?.()
          } else if (act.id === 'fleet') {
            o.send(EVENT_CHANNELS.navigate, {})
          } else if (act.id === 'server' && act.serverId) {
            o.send(EVENT_CHANNELS.navigate, { serverId: act.serverId })
          }
        }
      })
      settings.onChange(() => trayController?.render())
    } catch {
      // Tray is not supported or running in headless/test environment
    }
  }

  const connections = new Map<string, SshConnection>()
  const execs = new Map<string, Exec>()
  const follows = new LogFollows()
  // The "key changed" alert is shown once per server, not on every failed poll; forgetting the key re-arms it.
  const alerted = new Set<string>()

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
      if (e instanceof HostKeyChangedError && !alerted.has(serverId)) {
        alerted.add(serverId)
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
  manager.onSnapshot((snapshot) => {
    o.send(EVENT_CHANNELS.snapshot, snapshot)
    const alerts = tracker.observe(snapshot, settings.get())
    for (const alert of alerts) {
      notifier.notify(alert)
    }
    if (trayController) {
      const latest = manager.latest()
      const snapMap: Record<string, Snapshot> = {}
      for (const snap of latest) snapMap[snap.serverId] = snap
      snapMap[snapshot.serverId] = snapshot
      const summary = fleetSummary(serverStore.list(), snapMap)
      trayController.update(summary)
    }
  })

  const actions = new ActionService(execFor, (id) => manager.get(id)?.paths ?? new PathRegistry())

  const forgetHostKey = (serverId: string): void => {
    const server = serverStore.list().find((s) => s.id === serverId)
    if (server) knownHosts.delete(`${server.host}:${server.port}`)
    alerted.delete(serverId)
    connections.get(serverId)?.close()
    manager.retry(serverId)
  }

  const services: IpcServices = {
    serverStore,
    secrets,
    manager: {
      add: (s) => manager.add(s),
      remove: (id) => {
        manager.remove(id)
        tracker.forget(id)
        connections.get(id)?.close()
        connections.delete(id)
        execs.delete(id)
      },
      setActiveServer: (id) => manager.setActiveServer(id),
      setFocus: (focus) => manager.setFocus(focus),
      latest: () => manager.latest(),
      retry: (id) => manager.retry(id)
    },
    follows,
    forgetHostKey,
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
      follows.stopAll()
      manager.stopAll()
      connections.forEach((c) => c.close())
    }
  }
}
