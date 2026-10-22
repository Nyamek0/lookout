import type { BrowserWindowConstructorOptions } from 'electron'
import { APP_NAME } from '../shared/brand'

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
