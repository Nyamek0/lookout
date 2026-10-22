import { useEffect } from 'react'

/** Asks before touching production, and shows the exact command that will run. */
export function ConfirmDialog({
  title,
  detail,
  body,
  command,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: {
  title: string
  /** What the action is aimed at (server and containers), so the user sees more than hexadecimal ids. */
  detail?: string
  body: string
  command: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-[10px] border border-line bg-panel p-5 text-sm"
      >
        <h2 id="confirm-title" className="mb-2 text-base font-semibold">{title}</h2>
        {detail && <p className="mb-2 font-medium">{detail}</p>}
        <p className="mb-2 text-dim">{body}</p>
        <code className="mb-4 block break-all rounded border border-line bg-ink p-2">{command}</code>
        <div className="flex justify-end gap-2">
          <button type="button" autoFocus onClick={onCancel} className="rounded-md border border-line px-3 py-1.5 hover:bg-ink">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="rounded-md bg-fg px-3 py-1.5 text-ink">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
