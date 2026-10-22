import { EventEmitter } from 'node:events'
import { serverStatus } from '../../shared/status'
import type {
  ContainerInfo,
  ContainerUsage,
  DomainCheck,
  GitInfo,
  HostMetrics,
  Snapshot,
  SnapshotWarning
} from '../../shared/types'
import {
  classifyDockerError,
  parseDockerInspect,
  parseDockerStats,
  parseDockerSystemDf
} from '../collect/docker'
import { checkDomain, isCheckableHost, type DomainDeps } from '../collect/domains'
import { classifyConnectError } from '../ssh/errors'
import { parseGitInfo } from '../collect/git'
import { cpuPercent, parseDf, parseMeminfo, parseProcStat, parseUptime, type CpuSample } from '../collect/host'
import { proxyProviders } from '../collect/providers'
import type { ProxyProvider, ProxySite } from '../collect/proxy'
import { detectProjects } from '../detect/projects'
import { buildCommand, type CommandName, type CommandParams } from '../security/commands'
import { PathRegistry } from '../security/pathRegistry'
import type { Exec, ExecResult } from '../ssh/connection'
import { History } from './history'

export interface MonitorOptions {
  serverId: string
  exec: Exec
  serverIp: string
  deps: DomainDeps
  providers?: ProxyProvider[]
  intervals?: { activeMs: number; backgroundMs: number }
}

const GIT_TTL_MS = 300_000
const DOMAIN_TTL_MS = 600_000
const DISK_TTL_MS = 60_000
const HISTORY_POINTS = 60
const MAX_DOMAINS = 50 // hostnames come from the server's proxy config: bound how many we probe

type DiskInfo = ReturnType<typeof parseDockerSystemDf>

export class ServerMonitor extends EventEmitter {
  readonly paths = new PathRegistry()
  private readonly intervals: { activeMs: number; backgroundMs: number }
  private readonly providers: ProxyProvider[]
  private readonly cpuHistory = new History(HISTORY_POINTS)
  private readonly memHistory = new History(HISTORY_POINTS)
  private readonly gitCache = new Map<string, { at: number; info: GitInfo | null }>()
  private readonly domainCache = new Map<string, { at: number; check: DomainCheck }>()
  private diskCache: { at: number; value: DiskInfo } | null = null
  private prevCpu: CpuSample | null = null
  private last: Snapshot | null = null
  private inflight: Promise<Snapshot> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private active = false
  private failures = 0
  private paused = false

  private serverIp: string

  constructor(private readonly o: MonitorOptions) {
    super()
    this.serverIp = o.serverIp
    this.intervals = o.intervals ?? { activeMs: 5000, backgroundMs: 45000 }
    this.providers = o.providers ?? proxyProviders
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.schedule(0)
  }

  stop(): void {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  setActive(active: boolean): void {
    if (this.active === active) return
    this.active = active
    // Restart the countdown so a newly selected server refreshes right away at the fast rate.
    if (this.running && !this.paused) this.schedule(active ? 0 : this.intervals.backgroundMs)
  }

  /** After a failed login or a refused/changed host key polling stops; this tries again now (the user acted). */
  retry(): void {
    this.paused = false
    this.failures = 0
    if (this.running) this.schedule(0)
  }

  /** For servers added by hostname: the address is resolved after the monitor starts. */
  setServerIp(ip: string): void {
    this.serverIp = ip
    this.domainCache.clear()
  }

  refresh(): Promise<Snapshot> {
    this.inflight ??= this.collect().finally(() => {
      this.inflight = null
    })
    return this.inflight
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.refresh().finally(() => {
        const next = this.nextDelay()
        if (this.running && next !== null) this.schedule(next)
      })
    }, delayMs)
  }

  /** Normal rate when healthy; doubling (up to 5 min) while unreachable; none while waiting for the user. */
  private nextDelay(): number | null {
    if (this.paused) return null
    const base = this.active ? this.intervals.activeMs : this.intervals.backgroundMs
    if (this.failures === 0) return base
    return Math.min(base * 2 ** Math.min(this.failures - 1, 6), 300_000)
  }

  private run(name: CommandName, params?: CommandParams, opts?: { timeoutMs?: number }): Promise<ExecResult> {
    return this.o.exec.exec(buildCommand(name, params, this.paths), opts)
  }

  private async collect(): Promise<Snapshot> {
    let snapshot: Snapshot
    try {
      snapshot = await this.build()
      this.failures = 0
      this.paused = false
    } catch (e) {
      const error = classifyConnectError(e)
      this.failures++
      // Retrying a refused login every few seconds trips fail2ban and locks the user out: wait for them instead.
      if (error.kind === 'auth' || error.kind === 'hostkey-refused' || error.kind === 'hostkey-changed') this.paused = true
      snapshot = {
        serverId: this.o.serverId,
        takenAt: Date.now(),
        reachable: false,
        host: null,
        history: { cpu: this.cpuHistory.values(), mem: this.memHistory.values() },
        projects: this.last?.projects ?? [],
        containers: this.last?.containers ?? [],
        undetected: this.last?.undetected ?? [],
        warnings: [],
        status: 'error',
        error
      }
    }
    this.last = snapshot
    this.emit('snapshot', snapshot)
    return snapshot
  }

  private async build(): Promise<Snapshot> {
    const now = Date.now()
    const [stat, mem, up, df, nproc] = await Promise.all([
      this.run('procStat'),
      this.run('procMeminfo'),
      this.run('procUptime'),
      this.run('dfRoot'),
      this.run('cpuCount')
    ])
    const sample = parseProcStat(stat.stdout)
    const cpu = this.prevCpu ? cpuPercent(this.prevCpu, sample) : 0
    this.prevCpu = sample
    const memory = parseMeminfo(mem.stdout)
    const disk = parseDf(df.stdout)
    const host: HostMetrics = {
      cpuPercent: cpu,
      memUsedBytes: memory.usedBytes,
      memTotalBytes: memory.totalBytes,
      diskUsedBytes: disk.usedBytes,
      diskTotalBytes: disk.totalBytes,
      uptimeSeconds: parseUptime(up.stdout),
      cores: Number(nproc.stdout.trim()) || 0
    }
    const memPercent = memory.totalBytes ? (memory.usedBytes / memory.totalBytes) * 100 : 0
    this.cpuHistory.push(cpu)
    this.memHistory.push(Math.round(memPercent * 10) / 10)

    const warnings = new Set<SnapshotWarning>()
    const { containers, usage } = await this.readDocker(warnings)
    for (const c of containers) {
      if (c.workingDir) this.paths.register(c.workingDir)
      c.configFiles?.forEach((f) => this.paths.register(f))
    }

    const sites = await this.readSites(warnings)
    for (const s of sites) if (s.staticRoot) this.paths.register(s.staticRoot)

    const dirs = new Set<string>()
    containers.forEach((c) => c.workingDir && dirs.add(c.workingDir))
    sites.forEach((s) => s.staticRoot && dirs.add(s.staticRoot))
    const gitByDir: Record<string, GitInfo | null> = {}
    for (const dir of dirs) gitByDir[dir] = await this.gitFor(dir, now)

    const domainChecks = await this.domainsFor(sites, now)
    const diskInfo = containers.length > 0 ? await this.diskUsage(now) : { volumes: {}, images: {} }

    const { projects, undetected } = detectProjects({
      containers,
      usage,
      sites,
      gitByDir,
      domainChecks,
      diskByProject: diskByProject(containers, diskInfo),
      hostMemTotalBytes: memory.totalBytes
    })

    return {
      serverId: this.o.serverId,
      takenAt: now,
      reachable: true,
      host,
      history: { cpu: this.cpuHistory.values(), mem: this.memHistory.values() },
      projects,
      containers,
      undetected,
      warnings: [...warnings],
      status: serverStatus(
        projects.map((p) => p.status),
        {
          cpuPercent: cpu,
          memPercent,
          diskPercent: disk.totalBytes ? (disk.usedBytes / disk.totalBytes) * 100 : 0
        }
      )
    }
  }

  private async readDocker(
    warnings: Set<SnapshotWarning>
  ): Promise<{ containers: ContainerInfo[]; usage: Record<string, ContainerUsage> }> {
    const none = { containers: [] as ContainerInfo[], usage: {} as Record<string, ContainerUsage> }
    try {
      const ps = await this.run('dockerPsIds')
      if (ps.code !== 0) {
        warnings.add(classifyDockerError(ps.stderr) ?? 'docker_unavailable')
        return none
      }
      const ids = ps.stdout.split(/\s+/).filter(Boolean)
      if (ids.length === 0) return none
      const [inspect, stats] = await Promise.all([this.run('dockerInspect', { ids }), this.run('dockerStats')])
      // When a container disappears between `ps` and `inspect`, docker still prints the others on stdout and exits 1.
      if (inspect.code !== 0 && !inspect.stdout.trim().startsWith('[')) {
        warnings.add(classifyDockerError(inspect.stderr) ?? 'docker_unavailable')
        return none
      }
      const containers = parseDockerInspect(inspect.stdout)
      // docker listed containers but we could read none of them: say so rather than show an empty, green server
      if (containers.length === 0) warnings.add('docker_unavailable')
      return { containers, usage: stats.code === 0 ? parseDockerStats(stats.stdout) : {} }
    } catch {
      // a hung or garbled docker must not make the whole server look unreachable: the host metrics are fine
      warnings.add('docker_unavailable')
      return none
    }
  }

  private async readSites(warnings: Set<SnapshotWarning>): Promise<ProxySite[]> {
    const sites: ProxySite[] = []
    let anyAvailable = false
    for (const provider of this.providers) {
      try {
        const r = await provider.detect({ exec: this.o.exec, paths: this.paths })
        if (r.available) {
          anyAvailable = true
          sites.push(...r.sites)
        }
      } catch {
        // one unreadable proxy must not hide the others
      }
    }
    if (!anyAvailable) warnings.add('proxy_unavailable')
    return sites
  }

  private async gitFor(dir: string, now: number): Promise<GitInfo | null> {
    const cached = this.gitCache.get(dir)
    if (cached && now - cached.at < GIT_TTL_MS) return cached.info
    let info: GitInfo | null = null
    try {
      const head = await this.run('gitInfo', { dir, part: 'head' }, { timeoutMs: 10_000 })
      if (head.code === 0 && head.stdout.trim()) {
        const remote = await this.run('gitInfo', { dir, part: 'remote' }, { timeoutMs: 10_000 })
        info = parseGitInfo(head.stdout, remote.code === 0 ? remote.stdout : '')
      }
    } catch {
      info = null // a slow or broken checkout: remember the failure so it is not retried every cycle
    }
    this.gitCache.set(dir, { at: now, info })
    return info
  }

  private async domainsFor(sites: ProxySite[], now: number): Promise<Record<string, DomainCheck>> {
    const hosts = [...new Set(sites.flatMap((s) => s.hosts))].filter(isCheckableHost).slice(0, MAX_DOMAINS)
    const stale = hosts.filter((h) => {
      const c = this.domainCache.get(h)
      return !c || now - c.at >= DOMAIN_TTL_MS
    })
    await Promise.all(
      stale.map(async (h) => {
        this.domainCache.set(h, { at: now, check: await checkDomain(h, this.serverIp, this.o.deps) })
      })
    )
    return Object.fromEntries(hosts.map((h) => [h, this.domainCache.get(h)!.check]))
  }

  private async diskUsage(now: number): Promise<DiskInfo> {
    if (this.diskCache && now - this.diskCache.at < DISK_TTL_MS) return this.diskCache.value
    let value: DiskInfo = { volumes: {}, images: {} }
    try {
      // walks every volume: can be slow on big hosts, so it gets its own limit and a failure is cached too
      const r = await this.run('dockerSystemDf', undefined, { timeoutMs: 20_000 })
      if (r.code === 0) value = parseDockerSystemDf(r.stdout)
    } catch {
      // keep the empty value
    }
    this.diskCache = { at: now, value }
    return value
  }
}

const withTag = (image: string): string => (/:[^/]+$/.test(image) ? image : `${image}:latest`)

/** Images used by a project's containers plus the volumes Compose prefixes with the project name. */
function diskByProject(containers: ContainerInfo[], df: DiskInfo): Record<string, number> {
  const out: Record<string, number> = {}
  const projects = new Map<string, ContainerInfo[]>()
  for (const c of containers) {
    const name = c.composeProject ?? c.name
    projects.set(name, [...(projects.get(name) ?? []), c])
  }
  for (const [name, members] of projects) {
    const images = new Set(members.map((c) => withTag(c.image)))
    let total = [...images].reduce((sum, i) => sum + (df.images[i] ?? 0), 0)
    if (members[0]?.composeProject) {
      for (const [volume, size] of Object.entries(df.volumes)) if (volume.startsWith(`${name}_`)) total += size
    }
    out[name] = total
  }
  return out
}
