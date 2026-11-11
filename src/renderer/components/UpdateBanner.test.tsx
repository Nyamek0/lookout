// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateInfo } from '../../shared/types'
import { i18n } from '../i18n'
import { UpdateBanner } from './UpdateBanner'

describe('UpdateBanner', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  const info: UpdateInfo = {
    currentVersion: '0.1.1',
    latestVersion: '0.2.0',
    hasUpdate: true,
    releaseUrl: 'https://github.com/Nyamek0/lookout/releases/tag/v0.2.0'
  }

  it('renders nothing when hasUpdate is false', () => {
    const { container } = render(
      <UpdateBanner
        info={{ ...info, hasUpdate: false }}
        onDismiss={() => {}}
        onDownload={() => {}}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the update message with the latest version', () => {
    render(
      <UpdateBanner
        info={info}
        onDismiss={() => {}}
        onDownload={() => {}}
      />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/0\.2\.0/)).toBeInTheDocument()
  })

  it('triggers onDownload when clicking download button', async () => {
    const onDownload = vi.fn()
    render(
      <UpdateBanner
        info={info}
        onDismiss={() => {}}
        onDownload={onDownload}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /download|télécharger/i }))
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('triggers onDismiss when clicking dismiss button', async () => {
    const onDismiss = vi.fn()
    render(
      <UpdateBanner
        info={info}
        onDismiss={onDismiss}
        onDownload={() => {}}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /dismiss|ignorer|plus tard/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
