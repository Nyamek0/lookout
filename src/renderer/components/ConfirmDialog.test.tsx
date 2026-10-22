// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../i18n'
import { ConfirmDialog } from './ConfirmDialog'

const props = {
  title: 'Restart 2 containers',
  body: 'This command will run on the server:',
  command: 'docker restart abcdef123456 123456abcdef',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel'
}

describe('ConfirmDialog', () => {
  it('shows the exact command that will run', () => {
    render(<ConfirmDialog {...props} onConfirm={() => {}} onCancel={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Restart 2 containers' })).toBeInTheDocument()
    expect(screen.getByText('docker restart abcdef123456 123456abcdef').tagName).toBe('CODE')
  })

  it('confirms and cancels', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog {...props} onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('cancels on Escape, never confirms', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<ConfirmDialog {...props} onConfirm={onConfirm} onCancel={onCancel} />)
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
