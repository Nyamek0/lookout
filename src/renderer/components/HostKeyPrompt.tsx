import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HostKeyChangedInfo, HostKeyPromptInfo } from '../../shared/ipc'

const overlay = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
const box = 'w-full max-w-md rounded-[10px] border border-line bg-panel p-5 text-sm'

/** Asks before trusting a new server key, and blocks loudly when a trusted one changes. */
export function HostKeyPrompt() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState<HostKeyPromptInfo | null>(null)
  const [changed, setChanged] = useState<HostKeyChangedInfo | null>(null)

  useEffect(() => {
    const offPrompt = window.lookout.hostKey.onPrompt(setPrompt)
    const offChanged = window.lookout.hostKey.onChanged(setChanged)
    return () => {
      offPrompt()
      offChanged()
    }
  }, [])

  const answer = (accept: boolean) => {
    if (!prompt) return
    void window.lookout.hostKey.answer(prompt.promptId, accept)
    setPrompt(null)
  }

  if (changed) {
    return (
      <div className={overlay}>
        <div role="alertdialog" aria-modal="true" aria-labelledby="hk-changed" className={`${box} border-bad`}>
          <h2 id="hk-changed" className="mb-2 text-base font-semibold text-bad">{t('hostKey.changedTitle')}</h2>
          <p className="mb-3 text-dim">{t('hostKey.changedBody')}</p>
          <p className="text-xs text-dim">{t('hostKey.expected')}</p>
          <code className="mb-2 block break-all">{changed.expected}</code>
          <p className="text-xs text-dim">{t('hostKey.received')}</p>
          <code className="mb-4 block break-all">{changed.actual}</code>
          <div className="flex justify-end">
            <button type="button" onClick={() => setChanged(null)} className="rounded-md border border-line px-3 py-1.5 hover:bg-ink">
              {t('hostKey.close')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!prompt) return null
  return (
    <div className={overlay}>
      <div role="dialog" aria-modal="true" aria-labelledby="hk-title" className={box}>
        <h2 id="hk-title" className="mb-2 text-base font-semibold">{t('hostKey.title')}</h2>
        <p className="mb-3 text-dim">{t('hostKey.body')}</p>
        <code className="mb-4 block break-all rounded border border-line bg-ink p-2">{prompt.fingerprint}</code>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => answer(false)} className="rounded-md border border-line px-3 py-1.5 hover:bg-ink">
            {t('hostKey.cancel')}
          </button>
          <button type="button" onClick={() => answer(true)} className="rounded-md bg-fg px-3 py-1.5 text-ink">
            {t('hostKey.trust')}
          </button>
        </div>
      </div>
    </div>
  )
}
