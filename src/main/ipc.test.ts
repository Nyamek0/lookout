import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { EVENT_CHANNELS, INVOKE_CHANNELS } from '../shared/ipc'
import type { ServerConfig } from '../shared/types'
import { ActionService } from './actions/actions'
import { createHandlers, registerIpc, type IpcServices } from './ipc'
import { LogFollows } from './logs/logs'
import { PathRegistry } from './security/pathRegistry'
import type { Exec } from './ssh/connection'
import { HostKeyPrompter } from './ssh/prompter'
import { MemorySecretStore } from './store/secrets'
import { ServerStore } from './store/serverStore'

const ID = 'abcdef123456'

function setup(over: Partial<IpcServices> = {}) {
  const file = join(mkdtempSync(join(tmpdir(), 'lookout-ipc-')), 'servers.json')
  const secrets = new MemorySecretStore()
  const added: ServerConfig[] = []
  const removed: string[] = []
  const active: string[] = []
  const events: { channel: string; payload: unknown }[] = []
  const stops: string[] = []
  const retried: string[] = []
  const forgotten: string[] = []
  const follows = new LogFollows()
  const exec: Exec = {
    exec: async () => ({ stdout: '2026-10-21T10:00:01.000000000Z hello\n', stderr: '', code: 0 }),
    stream: () => ({ stop: () => stops.push('stopped') })
  }
  const services: IpcServices = {
    serverStore: new ServerStore(file),
    secrets,
    manager: {
      add: (s) => added.push(s),
      remove: (id) => removed.push(id),
      setActiveServer: (id) => active.push(id),
      retry: (id) => retried.push(id)
    },
    follows,
    forgetHostKey: (id) => forgotten.push(id),
    actions: new ActionService(() => exec, () => new PathRegistry()),
    execFor: () => exec,
    readSshConfig: () => ({ text: 'Host vps\n  HostName 1.2.3.4\n  User root\n' }),
    settings: { getLanguage: async () => 'en', setLanguage: async () => {} },
    prompter: new HostKeyPrompter(() => {}),
    emit: (channel, payload) => events.push({ channel, payload }),
    ...over
  }
  return { handlers: createHandlers(services), services, secrets, file, added, removed, active, events, stops, retried, forgotten, follows }
}

describe('ipc handlers', () => {
  it('exposes exactly the declared invoke channels', () => {
    expect(Object.keys(setup().handlers).sort()).toEqual([...INVOKE_CHANNELS].sort())
  })

  it('keeps a new server secret in the keychain only', async () => {
    const { handlers, secrets, file, added } = setup()
    const server = (await handlers['servers:add']!({
      name: 'vps', host: '1.2.3.4', port: 22, user: 'root', authType: 'password', secret: 'hunter2'
    })) as ServerConfig
    expect(await secrets.get(server.id)).toBe('hunter2')
    expect(JSON.stringify(server)).not.toContain('hunter2')
    expect(readFileSync(file, 'utf8')).not.toContain('hunter2')
    expect(added).toEqual([server])
  })

  it('removes a server, its secret and its monitor', async () => {
    const { handlers, secrets, removed, services } = setup()
    const server = (await handlers['servers:add']!({ name: 'v', host: 'h', port: 22, user: 'u', authType: 'password', secret: 's' })) as ServerConfig
    await handlers['servers:remove']!(server.id)
    expect(services.serverStore.list()).toEqual([])
    expect(await secrets.get(server.id)).toBeUndefined()
    expect(removed).toEqual([server.id])
  })

  it('imports hosts from ssh config', async () => {
    const hosts = (await setup().handlers['servers:importSshConfig']!()) as { alias: string }[]
    expect(hosts.map((h) => h.alias)).toEqual(['vps'])
  })

  it('lets the user retry a server and forget a pinned host key', async () => {
    const { handlers, retried, forgotten } = setup()
    await handlers['monitor:retry']!('s1')
    await handlers['hostKey:forget']!('s1')
    expect(retried).toEqual(['s1'])
    expect(forgotten).toEqual(['s1'])
  })

  it('closes the live logs and forgets the pinned key of a server that is removed', async () => {
    const stopped: string[] = []
    const { handlers, forgotten, follows } = setup()
    follows.add('sub-1', 'gone', { stop: () => stopped.push('gone') })
    follows.add('sub-2', 'kept', { stop: () => stopped.push('kept') })
    await handlers['servers:remove']!('gone')
    expect(stopped).toEqual(['gone'])
    expect(forgotten).toEqual(['gone'])
  })

  it('tells the renderer when a live log stream ends on its own', async () => {
    let end: (reason?: string) => void = () => {}
    const exec: Exec = {
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      stream: (_argv, _onData, onEnd) => {
        end = onEnd ?? (() => {})
        return { stop() {} }
      }
    }
    const { handlers, events } = setup({ execFor: () => exec })
    const subId = (await handlers['logs:follow']!('s1', ID)) as string
    end('container stopped')
    expect(events).toContainEqual({ channel: EVENT_CHANNELS.logEnded, payload: { subId, reason: 'container stopped' } })
  })

  it('selects the active server', async () => {
    const { handlers, active } = setup()
    await handlers['monitor:setActive']!('s1')
    expect(active).toEqual(['s1'])
  })

  it('answers confirm for an unknown action with ok:false instead of throwing', async () => {
    const r = (await setup().handlers['actions:confirm']!('nope')) as { ok: boolean; stderr: string }
    expect(r.ok).toBe(false)
    expect(r.stderr).toMatch(/unknown|expired/i)
  })

  it('prepares a restart without running it', async () => {
    const { handlers } = setup()
    const p = (await handlers['actions:prepareRestart']!('s1', [ID])) as { command: string }
    expect(p.command).toBe(`docker restart ${ID}`)
  })

  it('rejects malformed arguments at the boundary', async () => {
    const { handlers } = setup()
    await expect(handlers['actions:prepareRestart']!('s1', 'not-an-array')).rejects.toThrow(TypeError)
    await expect(handlers['monitor:setActive']!(42)).rejects.toThrow(TypeError)
  })

  it('fetches logs through the server exec', async () => {
    const chunk = (await setup().handlers['logs:fetch']!('s1', ID, { tail: 10 })) as { lines: string[] }
    expect(chunk.lines).toEqual(['2026-10-21T10:00:01.000000000Z hello'])
  })

  it('streams logs to the renderer and stops on unfollow', async () => {
    let push: (c: string) => void = () => {}
    const stops: string[] = []
    const exec: Exec = {
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      stream: (_argv, onData) => {
        push = onData
        return { stop: () => stops.push('x') }
      }
    }
    const { handlers, events } = setup({ execFor: () => exec })
    const subId = (await handlers['logs:follow']!('s1', ID)) as string
    push('line one\n')
    expect(events).toContainEqual({ channel: EVENT_CHANNELS.logLines, payload: { subId, lines: ['line one'] } })
    await handlers['logs:unfollow']!(subId)
    expect(stops).toEqual(['x'])
  })
})

describe('registerIpc', () => {
  it('answers only the app page: any other sender is refused', async () => {
    const registered = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
    const { handlers } = setup()
    registerIpc({ handle: (channel, fn) => void registered.set(channel, fn as never) }, handlers, (url) => url === 'app://ok/')
    expect([...registered.keys()].sort()).toEqual([...INVOKE_CHANNELS].sort())

    const list = registered.get('servers:list')!
    await expect(list({ senderFrame: { url: 'https://evil.example/' } })).rejects.toThrow(/untrusted/i)
    await expect(list({ senderFrame: undefined })).rejects.toThrow(/untrusted/i)
    await expect(list({ senderFrame: { url: 'app://ok/' } })).resolves.toEqual([])
  })
})

describe('HostKeyPrompter', () => {
  it('asks the user and resolves with their answer', async () => {
    const seen: { promptId: string; fingerprint: string }[] = []
    const prompter = new HostKeyPrompter((p) => seen.push(p))
    const answer = prompter.ask('s1', 'SHA256:abc')
    expect(seen[0]).toMatchObject({ serverId: 's1', fingerprint: 'SHA256:abc' })
    prompter.answer(seen[0]!.promptId, true)
    await expect(answer).resolves.toBe(true)
  })

  it('treats an unanswered prompt as a refusal after the timeout', async () => {
    vi.useFakeTimers()
    const prompter = new HostKeyPrompter(() => {}, 1000)
    const answer = prompter.ask('s1', 'SHA256:abc')
    await vi.advanceTimersByTimeAsync(1001)
    await expect(answer).resolves.toBe(false)
    vi.useRealTimers()
  })

  it('ignores an answer for an unknown prompt', () => {
    expect(() => new HostKeyPrompter(() => {}).answer('nope', true)).not.toThrow()
  })
})
