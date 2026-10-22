import { I18nextProvider, useTranslation } from 'react-i18next'
import { i18n } from './i18n'

function Content() {
  const { t } = useTranslation()
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
      <p className="text-sm text-neutral-500">{t('app.tagline')}</p>
    </main>
  )
}

export function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Content />
    </I18nextProvider>
  )
}
