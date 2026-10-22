// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LookoutApi } from '../../shared/ipc'
import type { LogChunk } from '../../shared/types'
import { useLogs } from './useLogs'

const ts = (n: number) => `2026-10-21T10:00:${String(n).padStart(2, '0')}.000000000Z`
const line = (n: number) => `${ts(n)} message ${n}`

let pushLines: (l: string[]) => void = () => {}
const stopFollow = vi.fn()
const fetch = vi.fn<(s: string, c: string, o: { tail: number; until?: string }) => Promise<LogChunk>>()
const follow = vi.fn(
  async (_s: string, _c: string, cb: (l: string[]) => void, _onEnd?: (reason?: string) => void) => ((pushLines = cb), stopFollow)
)

beforeEach(() => {
  fetch.mockReset()
  follow.mockClear()
  stopFollow.mockClear()
  window.lookout = { logs: { fetch, follow } } as unknown as LookoutApi
})

describe('useLogs', () => {
  it('loads the tail, then appends streamed lines', async () => {
    fetch.mockResolvedValueOnce({ lines: [line(3), line(4)], oldest: ts(3) })
    const { result } = renderHook(() => useLogs('s1', 'c1'))
    await waitFor(() => expect(result.current.lines).toEqual([line(3), line(4)]))
    expect(fetch).toHaveBeenCalledWith('s1', 'c1', { tail: 500 })
    act(() => pushLines([line(5)]))
    expect(result.current.lines.at(-1)).toBe(line(5))
  })

  it('loads older history before the oldest line and prepends it', async () => {
    fetch.mockResolvedValueOnce({ lines: [line(3), line(4)], oldest: ts(3) })
    const { result } = renderHook(() => useLogs('s1', 'c1'))
    await waitFor(() => expect(result.current.lines).toHaveLength(2))

    fetch.mockResolvedValueOnce({ lines: [line(1), line(2)], oldest: ts(1) })
    await act(() => result.current.loadOlder())
    expect(fetch).toHaveBeenLastCalledWith('s1', 'c1', { tail: 500, until: ts(3) })
    expect(result.current.lines).toEqual([line(1), line(2), line(3), line(4)])
    expect(result.current.canLoadOlder).toBe(true)
  })

  it('stops offering older lines once there are none left', async () => {
    fetch.mockResolvedValueOnce({ lines: [line(3)], oldest: ts(3) })
    const { result } = renderHook(() => useLogs('s1', 'c1'))
    await waitFor(() => expect(result.current.lines).toHaveLength(1))
    fetch.mockResolvedValueOnce({ lines: [], oldest: undefined })
    await act(() => result.current.loadOlder())
    expect(result.current.canLoadOlder).toBe(false)
  })

  it('notices when the live stream ends and reconnects on request', async () => {
    let end: (reason?: string) => void = () => {}
    follow.mockImplementation(async (_s, _c, cb, onEnd) => {
      pushLines = cb
      end = onEnd ?? (() => {})
      return stopFollow
    })
    fetch.mockResolvedValue({ lines: [line(1)], oldest: ts(1) })
    const { result } = renderHook(() => useLogs('s1', 'c1'))
    await waitFor(() => expect(follow).toHaveBeenCalledTimes(1))
    expect(result.current.streamEnded).toBe(false)

    act(() => end('container stopped'))
    expect(result.current.streamEnded).toBe(true)

    await act(async () => result.current.reconnect())
    await waitFor(() => expect(follow).toHaveBeenCalledTimes(2))
    expect(result.current.streamEnded).toBe(false)
  })

  it('reports a read error and stops following on unmount', async () => {
    fetch.mockRejectedValueOnce(new Error('No such container'))
    const { result, unmount } = renderHook(() => useLogs('s1', 'c1'))
    await waitFor(() => expect(result.current.error).toBe('No such container'))
    await waitFor(() => expect(follow).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(stopFollow).toHaveBeenCalled())
  })
})
