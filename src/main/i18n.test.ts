import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../shared/brand'
import { createMainI18n } from './i18n'

describe('main i18n', () => {
  it('translates in English by default and injects app name', () => {
    const i18n = createMainI18n()
    expect(i18n.language).toBe('en')
    expect(i18n.t('tray.open')).toContain(APP_NAME)
  })

  it('handles singular and plural in English and French', async () => {
    const i18n = createMainI18n()
    expect(i18n.t('notify.issues', { count: 1 })).toBe('1 issue')
    expect(i18n.t('notify.issues', { count: 3 })).toBe('3 issues')

    await i18n.changeLanguage('fr')
    expect(i18n.t('notify.issues', { count: 1 })).toBe('1 problème')
    expect(i18n.t('notify.issues', { count: 3 })).toBe('3 problèmes')
  })

  it('follows language updates from the settings store', () => {
    let cb: (p: { language: 'en' | 'fr' }) => void = () => {}
    const fakeSettings = {
      get: () => ({ language: 'en' as const }),
      onChange: (listener: (p: { language: 'en' | 'fr' }) => void) => {
        cb = listener
        return () => {}
      }
    }
    const i18n = createMainI18n(fakeSettings)
    expect(i18n.language).toBe('en')
    cb({ language: 'fr' })
    expect(i18n.language).toBe('fr')
    expect(i18n.t('tray.open')).toBe(`Ouvrir ${APP_NAME}`)
  })
})
