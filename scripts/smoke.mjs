// End-to-end smoke test: starts the BUILT app in demo mode and drives it through the DevTools protocol.
// Run `npm run build` first. It exits 0 when the whole path works, 1 otherwise.
//   ssh host key prompt -> home screen with live data -> project page -> restart asks for confirmation.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// SMOKE_APP points at a packaged executable (what users download); without it the freshly built sources are started.
const packaged = process.env.SMOKE_APP
const electronPath = packaged ?? require('electron')
const port = 9300 + Math.floor(Math.random() * 400)
const TIMEOUT_MS = 90_000

const args = [...(packaged ? [] : ['.']), `--remote-debugging-port=${port}`]
// CI runners on Linux have no usable sandbox.
if (process.platform === 'linux') args.push('--no-sandbox')

const app = spawn(electronPath, args, {
  env: { ...process.env, LOOKOUT_DEMO: '1', ELECTRON_ENABLE_LOGGING: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
})
let appLog = ''
app.stdout.on('data', (d) => (appLog += d))
app.stderr.on('data', (d) => (appLog += d))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const failures = []

function finish(code, message) {
  if (message) console.log(message)
  if (code !== 0) console.log(`--- app log (last 40 lines)\n${appLog.split('\n').slice(-40).join('\n')}`)
  app.kill()
  setTimeout(() => process.exit(code), 300)
}

const watchdog = setTimeout(() => finish(1, `FAIL: timed out after ${TIMEOUT_MS / 1000}s`), TIMEOUT_MS)
app.on('exit', (code) => {
  if (code !== null && code !== 0 && !failures.includes('done')) finish(1, `FAIL: the app exited early with code ${code}`)
})

async function connect() {
  for (let i = 0; i < 120; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // not listening yet
    }
    await sleep(500)
  }
  throw new Error('the app never opened its debugging port')
}

try {
  const ws = new WebSocket(await connect())
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('cannot attach to the page'))
  })
  let nextId = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id !== undefined) pending.get(d.id)?.(d)
    if (d.method === 'Runtime.exceptionThrown') failures.push(`uncaught page error: ${d.params.exceptionDetails.text}`)
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const run = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value

  const text = () => run('document.body.innerText')
  // `contains` is for rows whose button text carries more than the label (a project row also shows its RAM).
  const click = (label, { contains = false } = {}) =>
    run(`(() => { const want = ${JSON.stringify(label)}; const b = [...document.querySelectorAll('button')].find((b) => (${contains} ? b.textContent.includes(want) : b.textContent.trim() === want) && !b.disabled); if (!b) return false; b.click(); return true })()`)
  async function until(description, check) {
    for (let i = 0; i < 160; i++) {
      const value = await check()
      if (value) return value
      await sleep(250)
    }
    throw new Error(`never saw: ${description}\n--- page text\n${await text()}`)
  }

  await until('the host key prompt', async () => (await text())?.includes('Trust this server?'))
  await until('the Trust button to be enabled', () => click('Trust'))
  await until('the home screen with live data', async () => {
    const t = await text()
    return t?.includes('Demo VPS') && /\d+ %/.test(t) && t.includes('WHO IS CONSUMING') && t.includes('backend')
  })
  await until('the project page', async () => (await click('backend', { contains: true })) && (await text())?.includes('Compose project'))
  await until('a restart confirmation that shows the exact command', async () => {
    await click('Restart')
    return run(`document.querySelector('[role=dialog]')?.innerText.includes('docker restart') ?? false`)
  })
  await click('Cancel')
  await until('the dialog to close', async () => !(await run(`!!document.querySelector('[role=dialog]')`)))

  if (failures.length) throw new Error(failures.join('\n'))
  failures.push('done')
  clearTimeout(watchdog)
  finish(0, 'OK: host key prompt, live home screen, project page and restart confirmation all work')
} catch (e) {
  clearTimeout(watchdog)
  finish(1, `FAIL: ${e.message}`)
}
