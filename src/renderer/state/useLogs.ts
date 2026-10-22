import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LogBuffer } from '../../shared/logBuffer'

const CHUNK = 500
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s/

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** The lines of one container: the latest tail, then the live stream, with older history on demand. */
export function useLogs(serverId: string, containerId: string) {
  const buffer = useRef(new LogBuffer())
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const bump = () => setVersion((v) => v + 1)

  useEffect(() => {
    const fresh = new LogBuffer()
    buffer.current = fresh
    setError(null)
    setExhausted(false)
    bump()

    let cancelled = false
    let stop: (() => void) | null = null

    void window.lookout.logs
      .fetch(serverId, containerId, { tail: CHUNK })
      .then((chunk) => {
        if (!cancelled) fresh.append(chunk.lines)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(message(e))
      })
      .then(async () => {
        if (cancelled) return
        const off = await window.lookout.logs.follow(serverId, containerId, (lines) => {
          if (cancelled) return
          fresh.append(lines)
          bump()
        })
        if (cancelled) off()
        else stop = off
      })
      .finally(() => {
        if (!cancelled) bump()
      })

    return () => {
      cancelled = true
      stop?.()
    }
  }, [serverId, containerId])

  const loadOlder = useCallback(async () => {
    const first = buffer.current.lines()[0]
    const until = first ? TIMESTAMP.exec(first)?.[1] : undefined
    if (!first || !until) return setExhausted(true)
    try {
      const chunk = await window.lookout.logs.fetch(serverId, containerId, { tail: CHUNK, until })
      const older = chunk.lines.filter((l) => l !== first)
      if (older.length === 0) setExhausted(true)
      else buffer.current.prependOlder(older)
      bump()
    } catch (e) {
      setError(message(e))
    }
  }, [serverId, containerId])

  // `version` is the change signal for the mutable buffer
  const lines = useMemo(() => buffer.current.lines(), [version])
  return { lines, loadOlder, canLoadOlder: !exhausted && buffer.current.canLoadOlder(), error }
}
