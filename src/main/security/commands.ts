import { PathRegistry } from './pathRegistry'

export type CommandName =
  | 'procStat'
  | 'procMeminfo'
  | 'procUptime'
  | 'dfRoot'
  | 'cpuCount'
  | 'dockerPsIds'
  | 'dockerInspect'
  | 'dockerStats'
  | 'dockerSystemDf'
  | 'dockerLogs'
  | 'dockerRestart'
  | 'caddyAdminConfig'
  | 'nginxConfig'
  | 'readFile'
  | 'gitInfo'

export interface CommandParams {
  ids?: string[]
  id?: string
  path?: string
  dir?: string
  part?: 'head' | 'remote'
  tail?: number
  until?: string
  since?: string
  /** Keep the command running and print new lines as they are written (needs --follow, or docker exits at once). */
  follow?: boolean
}

type Builder = (p: CommandParams, registry: PathRegistry) => string[]

const CONTAINER_ID = /^[a-f0-9]{12,64}$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z?$/

function containerId(id: string | undefined): string {
  if (!id || !CONTAINER_ID.test(id)) throw new Error(`invalid container id: ${String(id)}`)
  return id
}

function containerIds(ids: string[] | undefined): string[] {
  if (!ids || ids.length === 0) throw new Error('at least one container id is required')
  return ids.map(containerId)
}

function registeredPath(path: string | undefined, registry: PathRegistry): string {
  if (!path || !registry.isAllowed(path)) throw new Error(`path not allowed: ${String(path)}`)
  return path
}

function timestamp(value: string): string {
  if (!TIMESTAMP.test(value)) throw new Error(`invalid timestamp: ${value}`)
  return value
}

const fixed = (...argv: string[]): Builder => () => argv

// One table, one entry per command: this is the whole surface the app can run on a server.
const TABLE: Record<CommandName, Builder> = {
  procStat: fixed('cat', '/proc/stat'),
  procMeminfo: fixed('cat', '/proc/meminfo'),
  procUptime: fixed('cat', '/proc/uptime'),
  dfRoot: fixed('df', '-PB1', '/'),
  cpuCount: fixed('nproc'),
  dockerPsIds: fixed('docker', 'ps', '-aq'),
  dockerInspect: (p) => ['docker', 'inspect', ...containerIds(p.ids)],
  dockerStats: fixed('docker', 'stats', '--no-stream', '--format', '{{json .}}'),
  dockerSystemDf: fixed('docker', 'system', 'df', '-v', '--format', 'json'),
  dockerLogs: (p) => {
    const tail = p.tail
    if (tail === undefined || !Number.isInteger(tail) || tail < 0 || tail > 1_000_000) {
      throw new Error(`invalid tail: ${String(tail)}`)
    }
    const argv = ['docker', 'logs', '--timestamps', ...(p.follow ? ['--follow'] : []), '--tail', String(tail)]
    if (p.until) argv.push('--until', timestamp(p.until))
    if (p.since) argv.push('--since', timestamp(p.since))
    argv.push(containerId(p.id))
    return argv
  },
  dockerRestart: (p) => ['docker', 'restart', ...containerIds(p.ids)],
  caddyAdminConfig: fixed('curl', '-sf', '--max-time', '3', 'http://127.0.0.1:2019/config/'),
  nginxConfig: fixed('nginx', '-T'),
  readFile: (p, r) => ['cat', '--', registeredPath(p.path, r)],
  gitInfo: (p, r) => {
    const dir = registeredPath(p.dir, r)
    return p.part === 'remote'
      ? ['git', '-C', dir, 'remote', 'get-url', 'origin']
      : [
          'git', '-C', dir,
          // The directory comes from server-side labels/config: never let its git config run anything.
          '-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false', '-c', 'core.pager=cat',
          'log', '-1', '--no-show-signature', '--format=%h%n%cI%n%s%n%D'
        ]
  }
}

export function buildCommand(
  name: CommandName,
  params: CommandParams = {},
  registry: PathRegistry = new PathRegistry()
): string[] {
  if (!Object.hasOwn(TABLE, name)) throw new Error(`unknown command: ${String(name)}`)
  return TABLE[name](params, registry)
}
