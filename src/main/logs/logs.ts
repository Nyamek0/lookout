import { buildCommand } from '../security/commands'
import type { Exec } from '../ssh/connection'

import type { LogChunk } from '../../shared/types'

export type { LogChunk }

const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s/
const stamp = (line: string): string => TIMESTAMP.exec(line)?.[1] ?? ''

/** docker writes a container's stdout and stderr to separate streams: put them back in time order. */
export async function fetchLogs(
  exec: Exec,
  containerId: string,
  o: { tail: number; until?: string }
): Promise<LogChunk> {
  const r = await exec.exec(buildCommand('dockerLogs', { id: containerId, tail: o.tail, until: o.until }))
  if (r.code !== 0) throw new Error(r.stderr.trim() || `docker logs exited with code ${r.code}`)
  const lines = [...r.stdout.split('\n'), ...r.stderr.split('\n')]
    .filter((l) => l.length > 0)
    .sort((a, b) => (stamp(a) < stamp(b) ? -1 : stamp(a) > stamp(b) ? 1 : 0))
  return { lines, oldest: lines[0] ? stamp(lines[0]) || undefined : undefined }
}

/** Streams new lines as they are written; chunks are re-assembled into whole lines. */
export function followLogs(
  exec: Exec,
  containerId: string,
  onLines: (lines: string[]) => void
): { stop(): void } {
  const argv = buildCommand('dockerLogs', { id: containerId, tail: 0, since: new Date().toISOString() })
  let pending = ''
  const handle = exec.stream(argv, (chunk) => {
    pending += chunk
    const parts = pending.split('\n')
    pending = parts.pop() ?? ''
    const lines = parts.filter((l) => l.length > 0)
    if (lines.length > 0) onLines(lines)
  })
  return { stop: () => handle.stop() }
}
