import { describe, expect, it } from 'vitest'
import { windowOptions } from './window'

describe('windowOptions', () => {
  it('isolates the renderer from node', () => {
    const prefs = windowOptions().webPreferences
    expect(prefs?.contextIsolation).toBe(true)
    expect(prefs?.nodeIntegration).toBe(false)
    expect(prefs?.sandbox).toBe(true)
  })
})
