import { useCallback, useState } from 'react'
import type { PreparedAction } from '../../shared/types'

type Result = { ok: boolean; stderr: string }

/** Two steps, on purpose: `request` only prepares and shows the command; `confirm` is what runs it. */
export function useRestart(serverId: string) {
  const [pending, setPending] = useState<PreparedAction | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const request = useCallback(
    async (containerIds: string[]) => {
      setResult(null)
      try {
        setPending(await window.lookout.actions.prepareRestart(serverId, containerIds))
      } catch (e) {
        setPending(null)
        setResult({ ok: false, stderr: e instanceof Error ? e.message : String(e) })
      }
    },
    [serverId]
  )

  const confirm = useCallback(async () => {
    if (!pending) return
    const { actionId } = pending
    setPending(null)
    setResult(await window.lookout.actions.confirm(actionId))
  }, [pending])

  const cancel = useCallback(() => setPending(null), [])
  const dismiss = useCallback(() => setResult(null), [])

  return { pending, result, request, confirm, cancel, dismiss }
}
