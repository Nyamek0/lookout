import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Preferences, PreferencesPatch, UpdateInfo } from '../../shared/types'
import { useAppStore } from '../state/store'

export interface SettingsProps {
  preferences?: Preferences
  onUpdatePreferences?: (patch: PreferencesPatch) => Promise<void>
  onTestNotification?: () => Promise<void>
  onCheckForUpdates?: () => Promise<UpdateInfo>
  onOpenReleasePage?: (url?: string) => Promise<void>
  isWindows?: boolean
}

export function Settings({
  preferences: propPreferences,
  onUpdatePreferences: propUpdatePreferences,
  onTestNotification: propTestNotification,
  onCheckForUpdates: propCheckForUpdates,
  onOpenReleasePage: propOpenReleasePage,
  isWindows = typeof navigator !== 'undefined' && /windows|win32/i.test(navigator.userAgent)
}: SettingsProps) {
  const { t, i18n } = useTranslation()
  const store = useAppStore()
  const prefs = propPreferences ?? store.preferences
  const update = propUpdatePreferences ?? store.updatePreferences
  const [testSent, setTestSent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateError, setUpdateError] = useState(false)

  const handleLanguageChange = (language: 'en' | 'fr') => {
    void i18n.changeLanguage(language)
    void update({ language })
  }

  const handleTestNotification = async () => {
    if (propTestNotification) {
      await propTestNotification()
    } else {
      await window.lookout?.settings.testNotification()
    }
    setTestSent(true)
    setTimeout(() => setTestSent(false), 3000)
  }

  const handleCheckUpdates = async () => {
    setChecking(true)
    setUpdateError(false)
    try {
      const info = propCheckForUpdates
        ? await propCheckForUpdates()
        : await window.lookout?.updates.check()
      if (info) {
        setUpdateInfo(info)
      } else {
        setUpdateError(true)
      }
    } catch {
      setUpdateError(true)
    } finally {
      setChecking(false)
    }
  }

  const handleDownload = async () => {
    if (!updateInfo?.releaseUrl) return
    if (propOpenReleasePage) {
      await propOpenReleasePage(updateInfo.releaseUrl)
    } else {
      await window.lookout?.updates.openReleasePage(updateInfo.releaseUrl)
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold text-fg">{t('settings.title')}</h1>

      {/* General / Language */}
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-5">
        <label className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-fg">{t('settings.language')}</div>
          </div>
          <select
            value={prefs.language}
            onChange={(e) => handleLanguageChange(e.target.value === 'fr' ? 'fr' : 'en')}
            className="rounded border border-line bg-ink px-2 py-1 text-sm text-fg"
          >
            <option value="en">English</option>
            <option value="fr">Français</option>
          </select>
        </label>
      </section>

      {/* Notifications */}
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dim">{t('settings.notifications')}</h2>

        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-fg">{t('settings.notificationsEnabled')}</div>
            <div className="text-xs text-dim">{t('settings.notificationsEnabledDesc')}</div>
          </div>
          <input
            type="checkbox"
            checked={prefs.notifications.enabled}
            onChange={(e) => void update({ notifications: { enabled: e.target.checked } })}
            className="h-4 w-4 rounded border-line bg-ink text-fg"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-fg">{t('settings.warnings')}</div>
            <div className="text-xs text-dim">{t('settings.warningsDesc')}</div>
          </div>
          <input
            type="checkbox"
            checked={prefs.notifications.warnings}
            onChange={(e) => void update({ notifications: { warnings: e.target.checked } })}
            className="h-4 w-4 rounded border-line bg-ink text-fg"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-fg">{t('settings.recoveries')}</div>
            <div className="text-xs text-dim">{t('settings.recoveriesDesc')}</div>
          </div>
          <input
            type="checkbox"
            checked={prefs.notifications.recoveries}
            onChange={(e) => void update({ notifications: { recoveries: e.target.checked } })}
            className="h-4 w-4 rounded border-line bg-ink text-fg"
          />
        </label>

        <div className="mt-2 flex items-center gap-3 border-t border-line/60 pt-4">
          <button
            type="button"
            onClick={() => void handleTestNotification()}
            className="rounded-md border border-line bg-ink px-3 py-1.5 text-sm font-medium text-fg hover:border-fg/40 hover:bg-panel"
          >
            {t('settings.testNotification')}
          </button>
          {testSent && <span className="text-xs text-ok">{t('settings.testNotificationSent')}</span>}
        </div>
      </section>

      {/* Windows specific option */}
      {isWindows && (
        <section className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-fg">{t('settings.keepInTray')}</div>
              <div className="text-xs text-dim">{t('settings.keepInTrayDesc')}</div>
            </div>
            <input
              type="checkbox"
              checked={prefs.keepInTray}
              onChange={(e) => void update({ keepInTray: e.target.checked })}
              className="h-4 w-4 rounded border-line bg-ink text-fg"
            />
          </label>
        </section>
      )}

      {/* Updates */}
      <section className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-dim">{t('updates.title')}</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-fg">
              {t('updates.current', { version: updateInfo?.currentVersion ?? '0.2.0' })}
            </div>
            {updateInfo && !updateInfo.hasUpdate && (
              <div className="mt-1 text-xs text-ok">
                {t('updates.upToDate', { version: updateInfo.currentVersion })}
              </div>
            )}
            {updateInfo && updateInfo.hasUpdate && (
              <div className="mt-1 text-xs text-warn">
                {t('updates.available', { version: updateInfo.latestVersion })}
              </div>
            )}
            {updateError && (
              <div className="mt-1 text-xs text-bad">
                {t('updates.failed')}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {updateInfo?.hasUpdate && (
              <button
                type="button"
                onClick={() => void handleDownload()}
                className="rounded-md bg-fg px-3 py-1.5 text-sm font-medium text-ink hover:bg-fg/90"
              >
                {t('updates.download')}
              </button>
            )}
            <button
              type="button"
              disabled={checking}
              onClick={() => void handleCheckUpdates()}
              className="rounded-md border border-line bg-ink px-3 py-1.5 text-sm font-medium text-fg hover:border-fg/40 hover:bg-panel disabled:opacity-50"
            >
              {checking ? t('updates.checking') : t('updates.check')}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
