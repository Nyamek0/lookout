import type { SshHost } from '../../shared/types'

export type { SshHost }

/** `include` resolves an Include pattern to the texts of the matching files (the caller owns the filesystem). */
export function parseSshConfig(text: string, include?: (pattern: string) => string[]): SshHost[] {
  const hosts: SshHost[] = []
  let current: SshHost[] = []

  const flush = () => current.splice(0)
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^(\S+?)(?:\s*=\s*|\s+)(.+)$/.exec(line)
    const key = (m ? m[1]! : line).toLowerCase()
    const value = m ? m[2]!.trim() : ''

    if (key === 'include' && include) {
      for (const sub of include(value)) hosts.push(...parseSshConfig(sub, include))
    } else if (key === 'match') {
      // Match blocks are conditional on things we cannot evaluate: do not leak their settings into the previous Host.
      flush()
      current = []
    } else if (key === 'host') {
      flush()
      current = value
        .split(/\s+/)
        .filter((a) => !/[*?!]/.test(a))
        .map((alias) => ({ alias, hostName: alias, port: 22 }))
      hosts.push(...current)
    } else if (key === 'hostname') current.forEach((h) => (h.hostName = value))
    else if (key === 'user') current.forEach((h) => (h.user = value))
    else if (key === 'port') current.forEach((h) => (h.port = Number(value) || 22))
    else if (key === 'identityfile') current.forEach((h) => (h.identityFile = value))
    else if (key === 'proxyjump') current.forEach((h) => (h.proxyJump = value))
  }
  return hosts
}
