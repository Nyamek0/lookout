export interface CpuSample {
  idle: number
  total: number
}

/** First `cpu ` line of /proc/stat. idle counts iowait; total is user..steal. */
export function parseProcStat(text: string): CpuSample {
  const line = text.split('\n').find((l) => l.startsWith('cpu '))
  if (!line) return { idle: 0, total: 0 }
  const f = line.trim().split(/\s+/).slice(1).map(Number)
  const n = (i: number) => f[i] ?? 0
  return { idle: n(3) + n(4), total: [0, 1, 2, 3, 4, 5, 6, 7].reduce((s, i) => s + n(i), 0) }
}

export function cpuPercent(prev: CpuSample, next: CpuSample): number {
  const total = next.total - prev.total
  if (total <= 0) return 0
  const busy = 1 - (next.idle - prev.idle) / total
  return Math.round(busy * 1000) / 10
}

export function parseMeminfo(text: string): { totalBytes: number; usedBytes: number } {
  const kb = (key: string): number => {
    const m = new RegExp(`^${key}:\\s+(\\d+)\\s+kB`, 'm').exec(text)
    return m ? Number(m[1]) * 1024 : 0
  }
  const totalBytes = kb('MemTotal')
  if (!totalBytes) return { totalBytes: 0, usedBytes: 0 }
  return { totalBytes, usedBytes: totalBytes - kb('MemAvailable') }
}

/** Output of `df -PB1 /`. */
export function parseDf(text: string): { totalBytes: number; usedBytes: number } {
  const lines = text.split('\n').filter((l) => l.trim())
  const cols = lines[1]?.trim().split(/\s+/)
  if (!cols || cols.length < 4) return { totalBytes: 0, usedBytes: 0 }
  return { totalBytes: Number(cols[1]) || 0, usedBytes: Number(cols[2]) || 0 }
}

export function parseUptime(text: string): number {
  return parseFloat(text.trim().split(/\s+/)[0] ?? '') || 0
}
