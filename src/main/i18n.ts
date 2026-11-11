import i18next, { type i18n as I18nInstance } from 'i18next'
import { APP_NAME } from '../shared/brand'
import en from '../renderer/i18n/en.json'
import fr from '../renderer/i18n/fr.json'

export interface SettingsForI18n {
  get(): { language: 'en' | 'fr' }
  onChange(cb: (preferences: { language: 'en' | 'fr' }) => void): () => void
}

export function createMainI18n(settings?: SettingsForI18n): I18nInstance {
  const instance = i18next.createInstance()
  const initialLng = settings ? settings.get().language : 'en'

  void instance.init({
    lng: initialLng,
    fallbackLng: 'en',
    resources: { en: { translation: en }, fr: { translation: fr } },
    interpolation: { escapeValue: false, defaultVariables: { appName: APP_NAME } },
    initAsync: false
  })

  if (settings) {
    settings.onChange((p) => {
      if (p.language !== instance.language) {
        void instance.changeLanguage(p.language)
      }
    })
  }

  return instance
}
