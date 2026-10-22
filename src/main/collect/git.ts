import type { GitInfo } from '../../shared/types'

/** `head` is the output of `git log -1 --format=%h%n%cI%n%s%n%D`, `remote` that of `git remote get-url origin`. */
export function parseGitInfo(head: string, remote = ''): GitInfo {
  const [commit, committedAt, subject, refs] = head.split('\n').map((l) => l.trim())
  const branch = /HEAD -> ([^,\s]+)/.exec(refs ?? '')?.[1] ?? null
  const url = remote.trim().replace(/\/\/[^@/\s]+@/, '//')
  return {
    remote: url || null,
    branch,
    commit: commit || null,
    committedAt: committedAt || null,
    subject: subject || null
  }
}
