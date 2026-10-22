import { useTranslation } from 'react-i18next'

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  const change = (language: 'en' | 'fr') => {
    void i18n.changeLanguage(language)
    void window.lookout?.settings.setLanguage(language)
  }
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-dim">
      {t('sidebar.language')}
      <select
        value={i18n.language === 'fr' ? 'fr' : 'en'}
        onChange={(e) => change(e.target.value === 'fr' ? 'fr' : 'en')}
        className="rounded border border-line bg-ink px-1 py-0.5 text-fg"
      >
        <option value="en">EN</option>
        <option value="fr">FR</option>
      </select>
    </label>
  )
}
