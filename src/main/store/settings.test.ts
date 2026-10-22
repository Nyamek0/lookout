import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
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
