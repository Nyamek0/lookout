import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { hardenWebContents, windowOptions } from './window'

describe('hardenWebContents', () => {
  const make = () => {
    const contents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() })
    hardenWebContents(contents, (url) => url === 'app://ok/')
    return contents
  }
  it('never opens a new window', () => {
    const contents = make()
    const handler = contents.setWindowOpenHandler.mock.calls[0]![0] as () => { action: string }
    expect(handler()).toEqual({ action: 'deny' })
  })
  it('blocks navigation to anything that is not the app, and allows the app itself', () => {
    const contents = make()
    const evil = { preventDefault: vi.fn() }
    contents.emit('will-navigate', evil, 'https://evil.example/')
    expect(evil.preventDefault).toHaveBeenCalled()
    const fine = { preventDefault: vi.fn() }
    contents.emit('will-navigate', fine, 'app://ok/')
    expect(fine.preventDefault).not.toHaveBeenCalled()
  })
})

describe('windowOptions', () => {
  it('isolates the renderer from node', () => {
    const prefs = windowOptions().webPreferences
    expect(prefs?.contextIsolation).toBe(true)
    expect(prefs?.nodeIntegration).toBe(false)
    expect(prefs?.sandbox).toBe(true)
  })
})
