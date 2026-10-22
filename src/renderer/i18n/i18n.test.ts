import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../../shared/brand'
import { i18n } from './index'
import en from './en.json'
import fr from './fr.json'

const flatten = (obj: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  )

describe('i18n', () => {
  it('has the same keys in English and French', () => {
    expect(flatten(fr).sort()).toEqual(flatten(en).sort())
  })

  it('defaults to English and injects the app name', () => {
    expect(i18n.language).toBe('en')
    expect(i18n.t('app.name')).toBe(APP_NAME)
  })
})
