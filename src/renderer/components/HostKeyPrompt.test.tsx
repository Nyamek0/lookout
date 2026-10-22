// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostKeyChangedInfo, HostKeyPromptInfo, LookoutApi } from '../../shared/ipc'
import '../i18n'
import { HostKeyPrompt } from './HostKeyPrompt'

let pushPrompt: (p: HostKeyPromptInfo) => void = () => {}
let pushChanged: (c: HostKeyChangedInfo) => void = () => {}
const answer = vi.fn(async () => {})

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

describe('HostKeyPrompt', () => {
  it('shows the fingerprint and trusts it on request', async () => {
    render(<HostKeyPrompt />)
    act(() => pushPrompt({ promptId: 'p1', serverId: 's1', fingerprint: 'SHA256:abc' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('SHA256:abc')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Trust' }))
    expect(answer).toHaveBeenCalledWith('p1', true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('refuses on cancel', async () => {
    render(<HostKeyPrompt />)
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
})
