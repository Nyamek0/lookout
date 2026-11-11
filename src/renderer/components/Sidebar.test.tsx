// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '../i18n'
import { Sidebar } from './Sidebar'

const servers = [
  { id: 'a', name: 'vps-main', status: 'ok' as const },
  { id: 'b', name: 'vps-client', status: 'error' as const }
]

describe('Sidebar', () => {
  it('lists every server with its status', () => {
    render(<Sidebar servers={servers} activeId="a" onSelect={() => {}} onAdd={() => {}} />)
    expect(screen.getByText('vps-main')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'error' })).toBeInTheDocument()
  })

  it('selects a server on click and marks the active one', async () => {
    const onSelect = vi.fn()
    render(<Sidebar servers={servers} activeId="a" onSelect={onSelect} onAdd={() => {}} />)
    await userEvent.click(screen.getByText('vps-client'))
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(screen.getByText('vps-main').closest('button')).toHaveAttribute('aria-current', 'true')
  })

  it('offers to add a server', async () => {
    const onAdd = vi.fn()
    render(<Sidebar servers={[]} activeId={null} onSelect={() => {}} onAdd={onAdd} />)
    await userEvent.click(screen.getByRole('button', { name: /add a server/i }))
    expect(onAdd).toHaveBeenCalled()
  })

  it('shows All servers item when more than one server exists', async () => {
    const onSelectFleet = vi.fn()
    render(
      <Sidebar
        servers={servers}
        activeId={null}
        isFleet={true}
        fleetStatus="error"
        onSelectFleet={onSelectFleet}
        onSelect={() => {}}
        onAdd={() => {}}
      />
    )
    const fleetBtn = screen.getByRole('button', { name: /all servers/i })
    expect(fleetBtn).toBeInTheDocument()
    expect(fleetBtn).toHaveAttribute('aria-current', 'true')
    await userEvent.click(fleetBtn)
    expect(onSelectFleet).toHaveBeenCalled()
  })

  it('navigates to settings when clicking the settings button', async () => {
    const onOpenSettings = vi.fn()
    render(
      <Sidebar
        servers={servers}
        activeId="a"
        isSettings={true}
        onSelect={() => {}}
        onAdd={() => {}}
        onOpenSettings={onOpenSettings}
      />
    )
    const settingsBtn = screen.getByRole('button', { name: /settings/i })
    expect(settingsBtn).toBeInTheDocument()
    expect(settingsBtn).toHaveAttribute('aria-current', 'true')
    await userEvent.click(settingsBtn)
    expect(onOpenSettings).toHaveBeenCalled()
  })
})
