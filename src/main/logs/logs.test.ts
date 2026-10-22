import { describe, expect, it } from 'vitest'
import type { Exec } from '../ssh/connection'
import { fetchLogs, followLogs } from './logs'

const ID = 'abcdef123456'

describe('fetchLogs', () => {
  it('merges stdout and stderr in timestamp order and reports the oldest timestamp', async () => {
    const exec: Exec = {
      exec: async (argv) => {
        expect(argv).toEqual(['docker', 'logs', '--timestamps', '--tail', '50', ID])
        return {
          stdout: '2026-10-21T10:00:01.000000000Z out-1\n2026-10-21T10:00:03.000000000Z out-3\n',
          stderr: '2026-10-21T10:00:02.000000000Z err-2\n',
          code: 0
        }
      },
      stream: () => ({ stop() {} })
    }
    const chunk = await fetchLogs(exec, ID, { tail: 50 })
    expect(chunk.lines).toEqual([
      '2026-10-21T10:00:01.000000000Z out-1',
      '2026-10-21T10:00:02.000000000Z err-2',
      '2026-10-21T10:00:03.000000000Z out-3'
    ])
    expect(chunk.oldest).toBe('2026-10-21T10:00:01.000000000Z')
  })

  it('asks for lines older than a timestamp', async () => {
    let seen: string[] = []
    const exec: Exec = {
      exec: async (argv) => {
        seen = argv
        return { stdout: '', stderr: '', code: 0 }
      },
      stream: () => ({ stop() {} })
    }
    const chunk = await fetchLogs(exec, ID, { tail: 10, until: '2026-10-21T10:00:01.000000000Z' })
    expect(seen).toContain('--until')
    expect(chunk).toEqual({ lines: [], oldest: undefined })
  })

  it('throws with the docker error when the command fails', async () => {
    const exec: Exec = {
      exec: async () => ({ stdout: '', stderr: 'Error: No such container', code: 1 }),
      stream: () => ({ stop() {} })
    }
    await expect(fetchLogs(exec, ID, { tail: 10 })).rejects.toThrow('No such container')
  })
})

describe('followLogs', () => {
  it('delivers whole lines even when chunks split them', () => {
    let push: (c: string) => void = () => {}
    let stopped = false
    const exec: Exec = {
      exec: async () => ({ stdout: '', stderr: '', code: 0 }),
      stream: (argv, onData) => {
        expect(argv.slice(0, 5)).toEqual(['docker', 'logs', '--timestamps', '--tail', '0'])
        expect(argv).toContain('--since')
        push = onData
        return { stop: () => (stopped = true) }
      }
    }
    const got: string[] = []
    const handle = followLogs(exec, ID, (l) => got.push(...l))
    push('a\nb')
    push('\nc\n')
    expect(got).toEqual(['a', 'b', 'c'])
    handle.stop()
    expect(stopped).toBe(true)
  })
})
