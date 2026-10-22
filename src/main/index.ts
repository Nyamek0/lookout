import { app, BrowserWindow, ipcMain } from 'electron'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHandlers, registerIpc } from './ipc'
import { createRuntime } from './runtime'
import { isTrustedUrl } from './security/sender'
import { MemorySecretStore } from './store/secrets'
import { hardenWebContents, windowOptions } from './window'

let mainWindow: BrowserWindow | null = null

const send = (channel: string, payload: unknown): void => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

const trusted = (url: string | undefined): boolean =>
  isTrustedUrl(url, {
    appFileUrl: pathToFileURL(join(__dirname, '../renderer/index.html')).href,
    devUrl: process.env['ELECTRON_RENDERER_URL']
  })

function createMainWindow(onReady: () => void, onReload: () => void): void {
  const win = new BrowserWindow(windowOptions(join(__dirname, '../preload/index.js')))
  mainWindow = win
  hardenWebContents(win.webContents as unknown as Parameters<typeof hardenWebContents>[0], trusted)
  win.webContents.once('did-finish-load', onReady)
  // A reload or a closed window drops the page's subscriptions: close the matching live log streams.
  win.webContents.on('did-start-loading', onReload)
  win.on('closed', () => {
    onReload()
    if (mainWindow === win) mainWindow = null
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** `npm run dev:demo`: a throwaway profile talking to a fixture-backed fake server, no real VPS needed. */
async function startDemo(): Promise<ReturnType<typeof createRuntime>> {
  const runtime = createRuntime({
    userData: mkdtempSync(join(tmpdir(), 'lookout-demo-')),
    send,
    secrets: new MemorySecretStore()
  })
  const { startDemoServer } = await import('../../scripts/demo-server')
  await startDemoServer(2222)
  const server = runtime.services.serverStore.add({
    name: 'Demo VPS', host: '127.0.0.1', port: 2222, user: 'demo', authType: 'password'
  })
  await runtime.services.secrets.set(server.id, 'demo')
  return runtime
}

void app.whenReady().then(async () => {
  const runtime =
    process.env['LOOKOUT_DEMO'] === '1' ? await startDemo() : createRuntime({ userData: app.getPath('userData'), send })
  registerIpc(ipcMain, createHandlers(runtime.services), trusted)
  const closeStreams = () => runtime.services.follows.stopAll()
  // Start polling once the interface is listening, so the first snapshots are not lost.
  createMainWindow(() => runtime.start(), closeStreams)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(() => runtime.start(), closeStreams)
  })
  app.on('before-quit', () => runtime.stop())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
