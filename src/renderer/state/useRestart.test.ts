// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LookoutApi } from '../../shared/ipc'
import type { PreparedAction } from '../../shared/types'
import { useRestart } from './useRestart'

const prepared = (ids: string[]): PreparedAction => ({
  actionId: 'act-1', serverId: 's1', label: `Restart ${ids.length} container`, command: `docker restart ${ids.join(' ')}`, expiresAt: 1
})
const prepareRestart = vi.fn(async (_s: string, ids: string[]) => prepared(ids))
const confirm = vi.fn(async (_id: string) => ({ ok: true, stderr: '' }))

beforeEach(() => {
  prepareRestart.mockClear()
  confirm.mockClear()
  window.lookout = { actions: { prepareRestart, confirm } } as unknown as LookoutApi
})

describe('useRestart', () => {
  it('prepares the restart and waits: nothing runs before confirmation', async () => {
    const { result } = renderHook(() => useRestart('s1'))
    await act(() => result.current.request(['abcdef123456', '123456abcdef']))
    expect(prepareRestart).toHaveBeenCalledWith('s1', ['abcdef123456', '123456abcdef'])
    expect(result.current.pending?.command).toBe('docker restart abcdef123456 123456abcdef')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('cancel drops the action without confirming it', async () => {
    const { result } = renderHook(() => useRestart('s1'))
    await act(() => result.current.request(['abcdef123456']))
    act(() => result.current.cancel())
    expect(result.current.pending).toBeNull()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('confirm runs the prepared action exactly once and reports success', async () => {
    const { result } = renderHook(() => useRestart('s1'))
    await act(() => result.current.request(['abcdef123456']))
    await act(() => result.current.confirm())
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledWith('act-1')
    expect(result.current.pending).toBeNull()
    expect(result.current.result).toEqual({ ok: true, stderr: '' })
    await act(() => result.current.confirm())
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('shows the server error when the restart fails', async () => {
    confirm.mockResolvedValueOnce({ ok: false, stderr: 'No such container' })
    const { result } = renderHook(() => useRestart('s1'))
    await act(() => result.current.request(['abcdef123456']))
    await act(() => result.current.confirm())
    expect(result.current.result).toEqual({ ok: false, stderr: 'No such container' })
  })

  it('reports a refused preparation instead of throwing', async () => {
    prepareRestart.mockRejectedValueOnce(new Error('invalid container id'))
    const { result } = renderHook(() => useRestart('s1'))
    await act(() => result.current.request(['nope']))
    expect(result.current.pending).toBeNull()
    expect(result.current.result).toEqual({ ok: false, stderr: 'invalid container id' })
  })
})
