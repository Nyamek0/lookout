import type { BrowserWindowConstructorOptions } from 'electron'
import { APP_NAME } from '../shared/brand'

interface Hardenable {
  on(event: 'will-navigate', listener: (event: { preventDefault(): void }, url: string) => void): unknown
  setWindowOpenHandler(handler: () => { action: 'deny' }): unknown
}

/** The window may only ever show the app: no pop-ups, no navigation to anything else (a dropped link or file). */
export function hardenWebContents(contents: Hardenable, isTrusted: (url: string) => boolean): void {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  contents.on('will-navigate', (event, url) => {
    if (!isTrusted(url)) event.preventDefault()
  })
}

export function windowOptions(preload?: string): BrowserWindowConstructorOptions {
  return {
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  }
}
