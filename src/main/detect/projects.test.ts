import { describe, expect, it } from 'vitest'
import type { ContainerInfo, ContainerUsage, DomainCheck, GitInfo } from '../../shared/types'
import type { ProxySite } from '../collect/proxy'
import { detectProjects } from './projects'

const c = (over: Partial<ContainerInfo>): ContainerInfo => ({
  id: 'aaaaaaaaaaaa',
  name: 'x',
  image: 'x',
  state: 'running',
  exitCode: 0,
  restartPolicy: 'no',
  publishedPorts: [],
  ...over
})
const empty = {
  containers: [] as ContainerInfo[],
  usage: {} as Record<string, ContainerUsage>,
  sites: [] as ProxySite[],
  gitByDir: {} as Record<string, GitInfo | null>,
  domainChecks: {} as Record<string, DomainCheck>,
  diskByProject: {} as Record<string, number>,
  hostMemTotalBytes: 10_000_000_000
}

const backendApi = c({ id: 'a1a1a1a1a1a1', name: 'backend-api-1', composeProject: 'backend', publishedPorts: [{ host: 8000, container: 8000 }] })
const backendRedis = c({ id: 'b2b2b2b2b2b2', name: 'backend-redis-1', composeProject: 'backend' })
const backendTusd = c({ id: 'c3c3c3c3c3c3', name: 'backend-tusd-1', composeProject: 'backend', publishedPorts: [{ host: 1080, container: 1080 }] })
const apiSite: ProxySite = {
  hosts: ['api.example.com'],
  upstreams: [{ host: '127.0.0.1', port: 8000 }, { host: '127.0.0.1', port: 1080 }]
}

describe('detectProjects', () => {
  it('returns nothing for empty input', () => {
    expect(detectProjects(empty)).toEqual({ projects: [], undetected: [] })
  })

  it('groups compose containers into one project', () => {
    const { projects } = detectProjects({ ...empty, containers: [backendApi, backendRedis] })
    expect(projects).toHaveLength(1)
    expect(projects[0]).toMatchObject({ name: 'backend', kind: 'compose', containerIds: ['a1a1a1a1a1a1', 'b2b2b2b2b2b2'] })
  })

  it('attaches a domain once even if several containers match its upstreams', () => {
    const { projects } = detectProjects({ ...empty, containers: [backendApi, backendTusd], sites: [apiSite] })
    expect(projects[0]!.domains.map((d) => d.host)).toEqual(['api.example.com'])
  })

  it('uses a domain check when available', () => {
    const check: DomainCheck = { host: 'api.example.com', ips: ['1.2.3.4'], matchesServer: true, tls: { ok: true, daysLeft: 30 } }
    const { projects } = detectProjects({ ...empty, containers: [backendApi], sites: [apiSite], domainChecks: { 'api.example.com': check } })
    expect(projects[0]!.domains[0]).toEqual(check)
  })

  it('matches an upstream given by container name or service name', () => {
    const app = c({ id: 'd4d4d4d4d4d4', name: 'web-app-1', service: 'app', composeProject: 'web' })
    const site: ProxySite = { hosts: ['web.example.com'], upstreams: [{ host: 'app', port: 3000 }] }
    const { projects } = detectProjects({ ...empty, containers: [app], sites: [site] })
    expect(projects[0]!.domains.map((d) => d.host)).toEqual(['web.example.com'])
  })

  it('makes a standalone container its own project', () => {
    const { projects } = detectProjects({ ...empty, containers: [c({ name: 'redis-cache' })] })
    expect(projects[0]).toMatchObject({ name: 'redis-cache', kind: 'container' })
  })

  it('turns a static site into a project without containers', () => {
    const site: ProxySite = { hosts: ['static.example.org'], upstreams: [], staticRoot: '/var/www/site' }
    const { projects } = detectProjects({ ...empty, sites: [site] })
    expect(projects[0]).toMatchObject({ name: 'static-site', kind: 'static', containerIds: [], status: 'neutral', staticRoot: '/var/www/site' })
  })

  it('lists proxied sites that no container serves as undetected', () => {
    const site: ProxySite = { hosts: ['legacy.example.com'], upstreams: [{ host: '127.0.0.1', port: 9999 }] }
    const { projects, undetected } = detectProjects({ ...empty, containers: [backendRedis], sites: [site] })
    expect(projects).toHaveLength(1)
    expect(undetected).toEqual(['legacy.example.com → 127.0.0.1:9999'])
  })

  it('keeps a container without any proxy site in its project', () => {
    const { projects } = detectProjects({ ...empty, containers: [backendRedis] })
    expect(projects[0]!.domains).toEqual([])
  })

  it('computes status from containers and resource thresholds', () => {
    const a = c({ id: 'a1a1a1a1a1a1', name: 'p-a', composeProject: 'p' })
    const b = c({ id: 'b2b2b2b2b2b2', name: 'p-b', composeProject: 'p' })
    const hot = detectProjects({ ...empty, containers: [a, b], usage: { a1a1a1a1a1a1: { cpuPercent: 40, memBytes: 1 }, b2b2b2b2b2b2: { cpuPercent: 31, memBytes: 1 } } })
    expect(hot.projects[0]).toMatchObject({ status: 'warn', usage: { cpuPercent: 71, memBytes: 2 } })
    const sick = detectProjects({ ...empty, containers: [{ ...a, health: 'unhealthy' }, b] })
    expect(sick.projects[0]!.status).toBe('error')
  })

  it('reads git info and disk size by project', () => {
    const git: GitInfo = { remote: null, branch: 'main', commit: 'abc1234', committedAt: null, subject: null }
    const withDir = c({ id: 'a1a1a1a1a1a1', name: 'p-a', composeProject: 'p', workingDir: '/opt/p', image: 'p-a:latest' })
    const { projects } = detectProjects({ ...empty, containers: [withDir], gitByDir: { '/opt/p': git }, diskByProject: { p: 1234 } })
    expect(projects[0]).toMatchObject({ git, diskBytes: 1234, deployMethod: 'git-pull', workingDir: '/opt/p' })
  })
})
