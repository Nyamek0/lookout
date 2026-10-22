import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HostKeyChangedInfo, HostKeyPromptInfo } from '../../shared/ipc'
import { useAppStore } from '../state/store'

const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
const box = 'w-full max-w-md rounded-[10px] border border-line bg-panel p-5 text-sm'

/**
 * Asks before trusting a new server key, and blocks loudly when a trusted one changes.
 * Prompts are queued (a new one never replaces the one being read), name the server they concern,
 * and "Trust" stays disabled for a moment after each new fingerprint appears.
 */
export function HostKeyPrompt({ armDelayMs = 500 }: { armDelayMs?: number }) {
  const { t } = useTranslation()
  const [queue, setQueue] = useState<HostKeyPromptInfo[]>([])
  const [changed, setChanged] = useState<HostKeyChangedInfo | null>(null)
  const [armed, setArmed] = useState(armDelayMs === 0)
  const current = queue[0]
  const currentId = current?.promptId
  const server = useAppStore((s) => s.servers.find((x) => x.id === current?.serverId))
  const changedServer = useAppStore((s) => s.servers.find((x) => x.id === changed?.serverId))

  useEffect(() => {
    const offPrompt = window.lookout.hostKey.onPrompt((p) => setQueue((q) => [...q, p]))
    const offChanged = window.lookout.hostKey.onChanged(setChanged)
    return () => {
      offPrompt()
      offChanged()
    }
  }, [])

  useEffect(() => {
    if (!currentId) return
    if (armDelayMs === 0) {
      setArmed(true)
      return
    }
    setArmed(false)
    const timer = setTimeout(() => setArmed(true), armDelayMs)
    return () => clearTimeout(timer)
  }, [currentId, armDelayMs])

  const answer = (accept: boolean) => {
    if (!current || (accept && !armed)) return
    void window.lookout.hostKey.answer(current.promptId, accept)
    setQueue((q) => q.slice(1))
  }

  const label = (id: string, s?: { name: string; host: string; port: number }) => (s ? `${s.name} (${s.host}:${s.port})` : id)

  if (changed) {
    return (
      <div className={overlay}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="hk-changed" className={`${box} border-bad`}>
          <h2 id="hk-changed" className="mb-2 text-base font-semibold text-bad">{t('hostKey.changedTitle')}</h2>
          <p className="mb-2 font-medium">{label(changed.serverId, changedServer)}</p>
          <p className="mb-3 text-dim">{t('hostKey.changedBody')}</p>
          <p className="text-xs text-dim">{t('hostKey.expected')}</p>
          <code className="mb-2 block break-all">{changed.expected}</code>
          <p className="text-xs text-dim">{t('hostKey.received')}</p>
          <code className="mb-4 block break-all">{changed.actual}</code>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                void window.lookout.hostKey.forget(changed.serverId)
                setChanged(null)
              }}
              className="rounded-md border border-bad/60 px-3 py-1.5 text-bad hover:bg-ink"
            >
              {t('hostKey.forget')}
            </button>
            <button type="button" onClick={() => setChanged(null)} className="rounded-md border border-line px-3 py-1.5 hover:bg-ink">
              {t('hostKey.close')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!current) return null
  return (
    <div className={overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby="hk-title" className={box}>
        <h2 id="hk-title" className="mb-2 text-base font-semibold">{t('hostKey.title')}</h2>
        <p className="mb-2 font-medium">{label(current.serverId, server)}</p>
        <p className="mb-3 text-dim">{t('hostKey.body')}</p>
        <code className="mb-4 block break-all rounded border border-line bg-ink p-2">{current.fingerprint}</code>
        {queue.length > 1 && <p className="mb-3 text-xs text-dim">{t('hostKey.waiting', { count: queue.length - 1 })}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => answer(false)} className="rounded-md border border-line px-3 py-1.5 hover:bg-ink">
            {t('hostKey.cancel')}
          </button>
          <button
            type="button"
            disabled={!armed}
            onClick={() => answer(true)}
            className="rounded-md bg-fg px-3 py-1.5 text-ink disabled:opacity-40"
          >
            {t('hostKey.trust')}
          </button>
        </div>
      </div>
    </div>
  )
}
