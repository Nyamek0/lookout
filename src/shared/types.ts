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

/** A host from ~/.ssh/config offered when adding a server. */
export interface SshHost {
  alias: string
  hostName: string
  user?: string
  port: number
  identityFile?: string
  proxyJump?: string
}

export interface LogChunk {
  lines: string[]
  /** Timestamp of the first line: pass it as `until` to read what came before. */
  oldest?: string
}

export interface PreparedAction {
  actionId: string
  serverId: string
  label: string
  /** The exact command that will run on the server, as the user will see it. */
  command: string
  expiresAt: number
}

/** A saved server. Never holds a secret: those live in the system keychain. */
export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  user: string
  authType: 'agent' | 'key' | 'password'
  keyPath?: string
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
