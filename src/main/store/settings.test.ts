import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES } from '../../shared/types'
import { SettingsStore } from './settings'

const tmp = () => join(mkdtempSync(join(tmpdir(), 'lookout-set-')), 'settings.json')

describe('SettingsStore', () => {
  it('defaults to English and remembers a choice', async () => {
    const file = tmp()
    expect(await new SettingsStore(file).getLanguage()).toBe('en')
    await new SettingsStore(file).setLanguage('fr')
    expect(await new SettingsStore(file).getLanguage()).toBe('fr')
  })
  it('ignores a corrupt or unknown value', async () => {
    const file = tmp()
    writeFileSync(file, '{"language":"klingon"}')
    expect(await new SettingsStore(file).getLanguage()).toBe('en')
    writeFileSync(file, 'nope')
    expect(await new SettingsStore(file).getLanguage()).toBe('en')
  })
})

describe('SettingsStore preferences', () => {
  it('starts from the defaults when there is no file', () => {
    expect(new SettingsStore(tmp()).get()).toEqual(DEFAULT_PREFERENCES)
  })

  it('merges an update with what is saved, and keeps it across restarts', () => {
    const file = tmp()
    new SettingsStore(file).update({ notifications: { warnings: true } })
    const prefs = new SettingsStore(file).get()
    expect(prefs.notifications).toEqual({ ...DEFAULT_PREFERENCES.notifications, warnings: true })
    expect(prefs.keepInTray).toBe(DEFAULT_PREFERENCES.keepInTray)
  })

  it('does not lose the other preferences when the language changes', async () => {
    const file = tmp()
    const store = new SettingsStore(file)
    store.update({ keepInTray: false, notifications: { enabled: false } })
    await store.setLanguage('fr')
    const prefs = new SettingsStore(file).get()
    expect(prefs).toMatchObject({ language: 'fr', keepInTray: false, notifications: { enabled: false } })
  })

  it('reads an old file that only holds the language', () => {
    const file = tmp()
    writeFileSync(file, '{"language":"fr"}')
    expect(new SettingsStore(file).get()).toEqual({ ...DEFAULT_PREFERENCES, language: 'fr' })
  })

  it('replaces wrongly typed values on disk with the defaults, field by field', () => {
    const file = tmp()
    writeFileSync(file, '{"keepInTray":"yes","notifications":{"enabled":false,"warnings":1},"extra":true}')
    expect(new SettingsStore(file).get()).toEqual({
      ...DEFAULT_PREFERENCES,
      notifications: { ...DEFAULT_PREFERENCES.notifications, enabled: false }
    })
  })

  it('writes the file atomically and tells listeners about changes', () => {
    const file = tmp()
    const store = new SettingsStore(file)
    const seen: unknown[] = []
    const off = store.onChange((p) => seen.push(p))
    store.update({ keepInTray: false })
    off()
    store.update({ keepInTray: true })
    expect(seen).toEqual([{ ...DEFAULT_PREFERENCES, keepInTray: false }])
    expect(existsSync(`${file}.tmp`)).toBe(false)
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ ...DEFAULT_PREFERENCES, keepInTray: true })
  })
})
