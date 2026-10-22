import { containerStatus, withThresholds, worst } from '../../shared/status'
import type { ContainerInfo, ContainerUsage, DomainCheck, GitInfo, Project } from '../../shared/types'
import type { ProxySite } from '../collect/proxy'
import { estimateDeployMethod } from './deployMethod'

export interface DetectInput {
  containers: ContainerInfo[]
  usage: Record<string, ContainerUsage>
  sites: ProxySite[]
  gitByDir: Record<string, GitInfo | null>
  domainChecks: Record<string, DomainCheck>
  diskByProject: Record<string, number>
  hostMemTotalBytes: number
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0', '::1'])

function serves(c: ContainerInfo, upstream: { host: string; port: number }): boolean {
  if (LOCAL_HOSTS.has(upstream.host)) return c.publishedPorts.some((p) => p.host === upstream.port)
  return upstream.host === c.name || upstream.host === c.service
}

const unchecked = (host: string): DomainCheck => ({ host, ips: [], matchesServer: null, tls: null })

export function detectProjects(i: DetectInput): { projects: Project[]; undetected: string[] } {
  const groups = new Map<string, { name: string; kind: Project['kind']; containers: ContainerInfo[] }>()
  for (const c of i.containers) {
    const compose = c.composeProject
    const key = compose ? `compose:${compose}` : `container:${c.name}`
    const group = groups.get(key) ?? { name: compose ?? c.name, kind: compose ? 'compose' : 'container', containers: [] }
    group.containers.push(c)
    groups.set(key, group)
  }

  const claimed = new Set<ProxySite>()
  const projects: Project[] = []

  for (const [key, g] of groups) {
    const domains = new Map<string, DomainCheck>()
    for (const site of i.sites) {
      if (!site.upstreams.some((u) => g.containers.some((c) => serves(c, u)))) continue
      claimed.add(site)
      for (const host of site.hosts) domains.set(host, i.domainChecks[host] ?? unchecked(host))
    }

    const usage = g.containers.reduce<ContainerUsage>(
      (sum, c) => ({
        cpuPercent: sum.cpuPercent + (i.usage[c.id]?.cpuPercent ?? 0),
        memBytes: sum.memBytes + (i.usage[c.id]?.memBytes ?? 0)
      }),
      { cpuPercent: 0, memBytes: 0 }
    )
    const workingDir = g.containers.find((c) => c.workingDir)?.workingDir
    const git = workingDir ? (i.gitByDir[workingDir] ?? null) : null
    const memPercentOfHost = i.hostMemTotalBytes > 0 ? (usage.memBytes / i.hostMemTotalBytes) * 100 : 0

    projects.push({
      id: key,
      name: g.name,
      kind: g.kind,
      containerIds: g.containers.map((c) => c.id),
      domains: [...domains.values()],
      workingDir,
      git,
      deployMethod: estimateDeployMethod(g.containers.map((c) => c.image), git),
      diskBytes: i.diskByProject[g.name] ?? null,
      usage,
      status: withThresholds(worst(g.containers.map(containerStatus)), {
        cpuPercent: usage.cpuPercent,
        memPercentOfHost
      })
    })
  }

  const undetected: string[] = []
  for (const site of i.sites) {
    if (claimed.has(site)) continue
    if (site.upstreams.length === 0 && site.staticRoot) {
      const git = i.gitByDir[site.staticRoot] ?? null
      projects.push({
        id: `static:${site.hosts[0]}`,
        name: site.staticRoot.split('/').filter(Boolean).pop() ?? site.hosts[0]!,
        kind: 'static',
        containerIds: [],
        domains: site.hosts.map((h) => i.domainChecks[h] ?? unchecked(h)),
        staticRoot: site.staticRoot,
        git,
        deployMethod: estimateDeployMethod([], git),
        diskBytes: null,
        usage: { cpuPercent: 0, memBytes: 0 },
        status: 'neutral'
      })
    } else if (site.upstreams.length > 0) {
      const u = site.upstreams[0]!
      undetected.push(`${site.hosts[0]} → ${u.host}:${u.port}`)
    }
  }

  return { projects, undetected }
}
