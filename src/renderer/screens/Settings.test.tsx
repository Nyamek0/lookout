// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFERENCES } from '../../shared/types'
import { i18n } from '../i18n'
import { Settings } from './Settings'

describe('Settings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })
  it('renders settings sections: language, notifications, and test button', () => {
    render(<Settings preferences={DEFAULT_PREFERENCES} isWindows={false} />)

    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/language/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/enable notifications/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/warning alerts/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/recovery alerts/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /test notification/i })).toBeInTheDocument()
    // Windows option should be hidden on macOS/Linux
    expect(screen.queryByLabelText(/keep in notification area/i)).not.toBeInTheDocument()
  })

  it('updates language when selector changes', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<Settings preferences={DEFAULT_PREFERENCES} onUpdatePreferences={onUpdate} isWindows={false} />)

    const select = screen.getByLabelText(/language/i)
    await userEvent.selectOptions(select, 'fr')

    expect(onUpdate).toHaveBeenCalledWith({ language: 'fr' })
  })

  it('toggles notifications enabled, warnings, and recoveries', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<Settings preferences={DEFAULT_PREFERENCES} onUpdatePreferences={onUpdate} isWindows={false} />)

    // Enabled is true by default -> toggle to false
    const enabledToggle = screen.getByLabelText(/enable notifications/i)
    await userEvent.click(enabledToggle)
    expect(onUpdate).toHaveBeenCalledWith({ notifications: { enabled: false } })

    // Warnings is false by default -> toggle to true
    const warningsToggle = screen.getByLabelText(/warning alerts/i)
    await userEvent.click(warningsToggle)
    expect(onUpdate).toHaveBeenCalledWith({ notifications: { warnings: true } })

    // Recoveries is true by default -> toggle to false
    const recoveriesToggle = screen.getByLabelText(/recovery alerts/i)
    await userEvent.click(recoveriesToggle)
    expect(onUpdate).toHaveBeenCalledWith({ notifications: { recoveries: false } })
  })

  it('shows and toggles keepInTray option only when on Windows', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    render(<Settings preferences={DEFAULT_PREFERENCES} onUpdatePreferences={onUpdate} isWindows={true} />)

    const keepInTrayToggle = screen.getByLabelText(/keep in notification area/i)
    expect(keepInTrayToggle).toBeInTheDocument()
    // Defaults to true -> toggle to false
    await userEvent.click(keepInTrayToggle)
    expect(onUpdate).toHaveBeenCalledWith({ keepInTray: false })
  })

  it('triggers test notification on button click', async () => {
    const onTest = vi.fn().mockResolvedValue(undefined)
    render(<Settings preferences={DEFAULT_PREFERENCES} onTestNotification={onTest} isWindows={false} />)

    const button = screen.getByRole('button', { name: /test notification/i })
    await userEvent.click(button)

    expect(onTest).toHaveBeenCalledTimes(1)
  })
})
