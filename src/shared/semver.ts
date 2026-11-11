export interface ParsedSemver {
  major: number
  minor: number
  patch: number
}

const SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)/

export function parseSemver(version: string): ParsedSemver | null {
  const clean = version.trim()
  const m = SEMVER_RE.exec(clean)
  if (!m) return null
  const major = parseInt(m[1]!, 10)
  const minor = parseInt(m[2]!, 10)
  const patch = parseInt(m[3]!, 10)
  return { major, minor, patch }
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa && !pb) return 0
  if (!pa) return -1
  if (!pb) return 1

  if (pa.major !== pb.major) return pa.major - pb.major
  if (pa.minor !== pb.minor) return pa.minor - pb.minor
  return pa.patch - pb.patch
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0
}

