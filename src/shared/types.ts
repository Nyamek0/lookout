export type Status = 'ok' | 'warn' | 'error' | 'neutral'

export interface ContainerInfo {
  id: string
  name: string
  image: string
  service?: string
  composeProject?: string
  workingDir?: string
  configFiles?: string[]
  state: 'running' | 'exited' | 'restarting' | 'paused' | 'created' | 'dead'
  exitCode: number
  health?: 'healthy' | 'unhealthy' | 'starting'
  restartPolicy: 'no' | 'always' | 'unless-stopped' | 'on-failure'
  startedAt?: string
  publishedPorts: { host: number; container: number }[]
}

export interface ContainerUsage {
  cpuPercent: number
  memBytes: number
}

export interface HostMetrics {
  cpuPercent: number
  memUsedBytes: number
  memTotalBytes: number
  diskUsedBytes: number
  diskTotalBytes: number
  uptimeSeconds: number
  cores: number
}

export interface GitInfo {
  remote: string | null
  branch: string | null
  commit: string | null
  committedAt: string | null
  subject: string | null
}

export type DeployMethod = 'ci-image' | 'git-pull' | 'file-copy'

export interface DomainCheck {
  host: string
  ips: string[]
  matchesServer: boolean | null
  tls: { ok: boolean; daysLeft?: number; error?: string } | null
}

export interface Project {
  id: string
  name: string
  kind: 'compose' | 'container' | 'static'
  containerIds: string[]
  domains: DomainCheck[]
  staticRoot?: string
  workingDir?: string
  git: GitInfo | null
  deployMethod: DeployMethod
  diskBytes: number | null
  usage: ContainerUsage
  status: Status
}

export type SnapshotWarning = 'docker_unavailable' | 'proxy_unavailable' | 'permission_denied'

export interface Snapshot {
  serverId: string
  takenAt: number
  reachable: boolean
  host: HostMetrics | null
  history: { cpu: number[]; mem: number[] }
  projects: Project[]
  containers: ContainerInfo[]
  undetected: string[]
  warnings: SnapshotWarning[]
  status: Status
}
