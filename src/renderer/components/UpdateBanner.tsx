import { useTranslation } from 'react-i18next'
import type { UpdateInfo } from '../../shared/types'

export function UpdateBanner({
  info,
  onDismiss,
  onDownload
}: {
  info: UpdateInfo
  onDismiss: () => void
  onDownload: () => void
}) {
  const { t } = useTranslation()

  if (!info.hasUpdate) {
    return null
  }

  return (
    <div
      role="status"
      className="mb-4 flex items-center justify-between rounded-md border border-fg/20 bg-panel px-4 py-2.5 text-sm"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-ok" />
        <span className="text-fg">
          {t('updates.banner', { version: info.latestVersion })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDownload}
          className="rounded bg-fg px-2.5 py-1 text-xs font-medium text-ink hover:bg-fg/90"
        >
          {t('updates.download')}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-dim hover:text-fg"
        >
          {t('updates.dismiss')}
        </button>
      </div>
    </div>
  )
}

