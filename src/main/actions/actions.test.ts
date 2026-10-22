import { describe, expect, it } from 'vitest'
import { PathRegistry } from '../security/pathRegistry'
import type { Exec } from '../ssh/connection'
import { ActionService } from './actions'

function setup(result = { stdout: '', stderr: '', code: 0 }) {
  const calls: string[][] = []
  const exec: Exec = {
    exec: async (argv) => {
      calls.push(argv)
      return result
    },
    stream: () => ({ stop() {} })
  }
  let now = 1_000_000
  const service = new ActionService(() => exec, () => new PathRegistry(), 60_000, () => now)
  return { service, calls, advance: (ms: number) => (now += ms) }
}

const ID = 'abcdef123456'

describe('ActionService', () => {
  it('prepares a restart without running anything, then runs exactly what it showed', async () => {
    const { service, calls } = setup()
    const prepared = service.prepareRestart('s1', [ID])
    expect(calls).toEqual([])
    expect(prepared.command).toBe(`docker restart ${ID}`)
    expect(prepared.serverId).toBe('s1')

    const result = await service.confirm(prepared.actionId)
    expect(result).toEqual({ ok: true, stderr: '' })
    expect(calls).toEqual([['docker', 'restart', ID]])
    expect(calls[0]!.join(' ')).toBe(prepared.command)
  })

  it('lists every container of a project in one command', () => {
    const { service } = setup()
    const other = '123456abcdef'
    expect(service.prepareRestart('s1', [ID, other]).command).toBe(`docker restart ${ID} ${other}`)
  })

  it('reports a failing restart with its stderr', async () => {
    const { service } = setup({ stdout: '', stderr: 'No such container', code: 1 })
    const prepared = service.prepareRestart('s1', [ID])
    expect(await service.confirm(prepared.actionId)).toEqual({ ok: false, stderr: 'No such container' })
  })

  it('refuses hostile container ids at prepare time', () => {
    const { service } = setup()
    expect(() => service.prepareRestart('s1', ['abc; rm -rf /'])).toThrow()
    expect(() => service.prepareRestart('s1', ['--all'])).toThrow()
  })

  it('rejects an unknown, reused or expired action', async () => {
    const { service, calls, advance } = setup()
    await expect(service.confirm('nope')).rejects.toThrow()

    const once = service.prepareRestart('s1', [ID])
    await service.confirm(once.actionId)
    await expect(service.confirm(once.actionId)).rejects.toThrow()

    const late = service.prepareRestart('s1', [ID])
    advance(60_001)
    await expect(service.confirm(late.actionId)).rejects.toThrow()
    expect(calls).toHaveLength(1)
  })
})
