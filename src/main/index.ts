import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { createHandlers, registerIpc } from './ipc'
import { createRuntime } from './runtime'
import { windowOptions } from './window'

let mainWindow: BrowserWindow | null = null

const send = (channel: string, payload: unknown): void => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function createMainWindow(onReady: () => void): void {
  const win = new BrowserWindow(windowOptions(join(__dirname, '../preload/index.js')))
  mainWindow = win
  win.webContents.once('did-finish-load', onReady)
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  const runtime = createRuntime({ userData: app.getPath('userData'), send })
  registerIpc(ipcMain, createHandlers(runtime.services))
  // Start polling once the interface is listening, so the first snapshots are not lost.
  createMainWindow(() => runtime.start())
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(() => runtime.start())
  })
  app.on('before-quit', () => runtime.stop())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
