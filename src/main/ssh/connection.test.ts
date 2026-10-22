import { afterEach, describe, expect, it } from 'vitest'
import { startFakeVps, type FakeHandler, type FakeVps } from '../../../test/support/fakeVps'
import { SshConnection } from './connection'
import { HostKeyChangedError, KnownHosts } from './hostKeys'

const servers: FakeVps[] = []
const conns: SshConnection[] = []

afterEach(async () => {
  conns.splice(0).forEach((c) => c.close())
  await Promise.all(servers.splice(0).map((s) => s.stop()))
})

async function setup(
  handler: FakeHandler = (argv) => ({ stdout: argv.slice(1).join(' ') + '\n', code: 0 })
) {
  const vps = await startFakeVps(handler)
  servers.push(vps)
  const knownHosts = new KnownHosts()
  const make = (over: Partial<ConstructorParameters<typeof SshConnection>[0]> = {}) => {
    const c = new SshConnection({
      host: '127.0.0.1',
      port: vps.port,
      user: 'root',
      auth: { type: 'password', password: 'x' },
      knownHosts,
      onUnknownHost: async () => true,
      ...over
    })
    conns.push(c)
    return c
  }
  return { vps, knownHosts, make }
}

describe('SshConnection', () => {
  it('runs a command and returns stdout and exit code 0', async () => {
    const { make } = await setup()
    const c = make()
    await c.connect()
    const r = await c.exec(['echo', 'hi'])
    expect(r).toMatchObject({ stdout: 'hi\n', code: 0 })
  })

  it('returns a non-zero exit code without throwing', async () => {
    const { make } = await setup(() => ({ stdout: '', code: 3 }))
    const c = make()
    expect((await c.exec(['false'])).code).toBe(3)
  })

  it('passes arguments through shell quoting intact', async () => {
    let seen: string[] = []
    const { make } = await setup((argv) => {
      seen = argv
      return { stdout: '', code: 0 }
    })
    await make().exec(['echo', "a'b", '$(id)', 'x; y'])
    expect(seen).toEqual(['echo', "a'b", '$(id)', 'x; y'])
  })

  it('asks before trusting an unknown host and remembers it when accepted', async () => {
    const { vps, knownHosts, make } = await setup()
    let asked = ''
    const c = make({
      onUnknownHost: async (fp) => {
        asked = fp
        return true
      }
    })
    await c.connect()
    expect(asked).toBe(vps.fingerprint)
    expect(knownHosts.get(`127.0.0.1:${vps.port}`)).toBe(vps.fingerprint)
  })

  it('fails when the user refuses an unknown host', async () => {
    const { vps, make } = await setup()
    const c = make({ onUnknownHost: async () => false })
    await expect(c.connect()).rejects.toThrow()
    expect(vps.authAttempts()).toBe(0)
  })

  it('blocks a changed host key before any authentication', async () => {
    const { vps, knownHosts, make } = await setup()
    knownHosts.set(`127.0.0.1:${vps.port}`, 'SHA256:someOtherFingerprint')
    const c = make()
    await expect(c.connect()).rejects.toBeInstanceOf(HostKeyChangedError)
    expect(vps.authAttempts()).toBe(0)
  })

  it('reconnects after the server restarts', async () => {
    const { vps, make } = await setup()
    const c = make()
    await c.connect()
    const { port, keys } = vps
    await vps.stop()
    servers.splice(servers.indexOf(vps), 1)
    const again = await startFakeVps(() => ({ stdout: 'back\n', code: 0 }), { port, hostKey: keys })
    servers.push(again)
    const r = await c.exec(['anything'])
    expect(r.stdout).toBe('back\n')
  })

  it('times out a slow command', async () => {
    const { make } = await setup(() => new Promise(() => {}))
    const c = make()
    await expect(c.exec(['sleep', '9'], { timeoutMs: 50 })).rejects.toThrow(/timed out/i)
  })
})
