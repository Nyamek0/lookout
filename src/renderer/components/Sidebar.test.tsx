// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../i18n'
import { Sidebar } from './Sidebar'

const servers = [
  { id: 'a', name: 'my-server', status: 'ok' as const },
  { id: 'b', name: 'vps-client', status: 'error' as const }
]

describe('Sidebar', () => {
  it('lists every server with its status', () => {
    render(<Sidebar servers={servers} activeId="a" onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByText('my-server')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'error' })).toBeInTheDocument()
  })

  it('selects a server on click and marks the active one', async () => {
    const onSelect = vi.fn()
    render(<Sidebar servers={servers} activeId="a" onSelect={onSelect} onAdd={() => {}} />)
    await userEvent.click(screen.getByText('vps-client'))
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(screen.getByText('my-server').closest('button')).toHaveAttribute('aria-current', 'true')
  })

  it('offers to add a server', async () => {
    const onAdd = vi.fn()
    render(<Sidebar servers={[]} activeId={null} onSelect={() => {}} onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: /add a server/i }))
    expect(onAdd).toHaveBeenCalled()
  })
})
