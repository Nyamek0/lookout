import { startFakeVps, type FakeHandler, type FakeVps } from '../test/support/fakeVps'
import { fixture } from '../test/support/fixture'

const IDS = 'd58c008e9380\nabc123def456\n999999999999\n'
const LOG_LINES = [
  'GET /healthz 200 1ms',
  'GET /dashboard 200 14ms',
  'queue: processed App\\Jobs\\SendDigest',
  'GET /api/chat 200 212ms',
  'ERROR upstream timeout while calling the AI service (demo line)',
  'POST /login 302 31ms'
]

/** A fake VPS for contributors: answers the app's fixed commands from recorded fixtures, so no server is needed. */
export function demoHandler(): FakeHandler {
  let tick = 0
  const ok = (stdout: string) => ({ stdout, code: 0 })

  return (argv) => {
    const cmd = argv.join(' ')
    if (cmd === 'cat /proc/stat') {
      tick++
      const user = 100_000 + tick * 220
      const system = 40_000 + tick * 90
      const idle = 800_000 + tick * (500 + Math.round(250 * Math.sin(tick / 4)))
      return ok(`cpu  ${user} 0 ${system} ${idle} 0 0 0 0 0 0\n`)
    }
    if (cmd === 'cat /proc/meminfo') return ok(fixture('meminfo.txt'))
    if (cmd === 'cat /proc/uptime') return ok('257395.33 1000.10\n')
    if (argv[0] === 'df') return ok(fixture('df.txt'))
    if (argv[0] === 'nproc') return ok('6\n')
    if (cmd === 'docker ps -aq') return ok(IDS)
    if (argv[0] === 'docker' && argv[1] === 'inspect') return ok(fixture('docker-inspect.json'))
    if (argv[0] === 'docker' && argv[1] === 'stats') return ok(fixture('docker-stats.txt'))
    if (argv[0] === 'docker' && argv[1] === 'system') return ok(fixture('docker-system-df.json'))
    if (argv[0] === 'curl') return ok(fixture('caddy-admin.json'))
    if (argv[0] === 'git') {
      return argv.includes('remote')
        ? ok('git@github.com:demo/app.git\n')
        : ok('abc1234\n2026-10-07T18:02:54+00:00\nfix: demo commit\nHEAD -> main, origin/main\n')
    }
    if (argv[0] === 'docker' && argv[1] === 'restart') return ok(`${argv.slice(2).join('\n')}\n`)
    // A followed stream never finishes by itself: keep it open and silent, like a quiet container.
    if (argv[0] === 'docker' && argv[1] === 'logs' && argv.includes('--follow')) return new Promise<never>(() => {})
    if (argv[0] === 'docker' && argv[1] === 'logs') {
      const tail = Number(argv[argv.indexOf('--tail') + 1] ?? 0)
      const older = argv.includes('--until')
      const now = Date.now() - (older ? 3_600_000 : 0)
      const count = Math.min(tail, 200)
      const lines = Array.from({ length: count }, (_, i) => {
        const at = new Date(now - (count - i) * 1000).toISOString()
        return `${at} ${LOG_LINES[(i + tick) % LOG_LINES.length]}`
      })
      return ok(lines.length ? `${lines.join('\n')}\n` : '')
    }
    return { stdout: '', code: 127 }
  }
}

export function startDemoServer(port = 2222): Promise<FakeVps> {
  return startFakeVps(demoHandler(), { port })
}
