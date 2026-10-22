// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostKeyChangedInfo, HostKeyPromptInfo, LookoutApi } from '../../shared/ipc'
import '../i18n'
import { useAppStore } from '../state/store'
import { HostKeyPrompt } from './HostKeyPrompt'

let pushPrompt: (p: HostKeyPromptInfo) => void = () => {}
let pushChanged: (c: HostKeyChangedInfo) => void = () => {}
const answer = vi.fn(async () => {})

afterEach(() => vi.useRealTimers())

beforeEach(() => {
  answer.mockClear()
  window.lookout = {
    hostKey: {
      onPrompt: (cb: (p: HostKeyPromptInfo) => void) => ((pushPrompt = cb), () => {}),
      onChanged: (cb: (c: HostKeyChangedInfo) => void) => ((pushChanged = cb), () => {}),
      answer
    }
  } as unknown as LookoutApi
})

describe('HostKeyPrompt safety', () => {
  beforeEach(() => {
    useAppStore.setState({
      servers: [
        { id: 's1', name: 'prod', host: '1.2.3.4', port: 22, user: 'root', authType: 'agent' },
        { id: 's2', name: 'staging', host: '5.6.7.8', port: 2222, user: 'deploy', authType: 'agent' }
      ]
    })
  })

  it('says which server is asking', () => {
    render(<HostKeyPrompt armDelayMs={0} />)
    act(() => pushPrompt({ promptId: 'p1', serverId: 's2', fingerprint: 'SHA256:abc' }))
    expect(screen.getByText(/staging/)).toBeInTheDocument()
    expect(screen.getByText(/5\.6\.7\.8:2222/)).toBeInTheDocument()
  })

  it('queues prompts: a new one never replaces the one being read', async () => {
    render(<HostKeyPrompt armDelayMs={0} />)
    act(() => pushPrompt({ promptId: 'p1', serverId: 's1', fingerprint: 'SHA256:first' }))
    act(() => pushPrompt({ promptId: 'p2', serverId: 's2', fingerprint: 'SHA256:second' }))
    expect(screen.getByText('SHA256:first')).toBeInTheDocument()
    expect(screen.queryByText('SHA256:second')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Trust' }))
    expect(answer).toHaveBeenCalledTimes(1)
    expect(answer).toHaveBeenLastCalledWith('p1', true)

    expect(screen.getByText('SHA256:second')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(answer).toHaveBeenLastCalledWith('p2', false)
  })

  it('keeps Trust disabled for a moment whenever a new fingerprint is shown', async () => {
    vi.useFakeTimers()
    render(<HostKeyPrompt armDelayMs={500} />)
    act(() => pushPrompt({ promptId: 'p1', serverId: 's1', fingerprint: 'SHA256:first' }))
    expect(screen.getByRole('button', { name: 'Trust' })).toBeDisabled()
    act(() => vi.advanceTimersByTime(501))
    expect(screen.getByRole('button', { name: 'Trust' })).toBeEnabled()
    vi.useRealTimers()
  })
})

describe('HostKeyPrompt', () => {
  it('shows the fingerprint and trusts it on request', async () => {
    render(<HostKeyPrompt armDelayMs={0} />)
    act(() => pushPrompt({ promptId: 'p1', serverId: 's1', fingerprint: 'SHA256:abc' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('SHA256:abc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Trust' }))
    expect(answer).toHaveBeenCalledWith('p1', true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses on cancel', async () => {
    render(<HostKeyPrompt armDelayMs={0} />)
    act(() => pushPrompt({ promptId: 'p2', serverId: 's1', fingerprint: 'SHA256:abc' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(answer).toHaveBeenCalledWith('p2', false)
  })

  it('warns about a changed key and offers no way to trust it', async () => {
    render(<HostKeyPrompt />)
    act(() => pushChanged({ serverId: 's1', expected: 'SHA256:old', actual: 'SHA256:new' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('SHA256:old')).toBeInTheDocument()
    expect(screen.getByText('SHA256:new')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Trust' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('lets the user forget a changed key on purpose (after rebuilding the server)', async () => {
    const forget = vi.fn(async () => {})
    ;(window.lookout.hostKey as unknown as { forget: typeof forget }).forget = forget
    render(<HostKeyPrompt />)
    act(() => pushChanged({ serverId: 's1', expected: 'SHA256:old', actual: 'SHA256:new' }))
    await userEvent.click(screen.getByRole('button', { name: 'Forget this key' }))
    expect(forget).toHaveBeenCalledWith('s1')
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
