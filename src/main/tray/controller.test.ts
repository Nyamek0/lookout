import { describe, expect, it, vi } from 'vitest'
import type { FleetServerSummary } from '../../shared/fleet'
import { createMainI18n } from '../i18n'
import { TrayController } from './controller'

describe('TrayController', () => {
  it('updates the tray image and menu when the summary changes', () => {
    const setImage = vi.fn()
    const setToolTip = vi.fn()
    const setContextMenu = vi.fn()
    const tray = { setImage, setToolTip, setContextMenu, on: vi.fn() }
    const createIcon = vi.fn((st) => `icon:${st}`)
    const buildMenu = vi.fn((items) => items)
    const onAction = vi.fn()
    const i18n = createMainI18n()

    const controller = new TrayController({
      tray,
      createIcon,
      buildMenu,
      t: (k, opts) => i18n.t(k, opts),
      onAction
    })

    const summary1: FleetServerSummary[] = [
      {
        server: { id: 's1', name: 'vps', host: '1.2.3.4', port: 22, user: 'root', authType: 'agent' },
        status: 'ok',
        counts: { ok: 1, warn: 0, error: 0, neutral: 0 },
        topIssues: [],
        ageSeconds: 2,
        hostPercent: null
      }
    ]

    controller.update(summary1)
    expect(setImage).toHaveBeenCalledWith('icon:ok')
    expect(setContextMenu).toHaveBeenCalledTimes(1)

    // Updating with identical summary state skips rebuilding
    controller.update(summary1)
    expect(setImage).toHaveBeenCalledTimes(1)
    expect(setContextMenu).toHaveBeenCalledTimes(1)

    // Updating with changed summary updates icon and menu
    const summary2: FleetServerSummary[] = [
      {
        ...summary1[0]!,
        status: 'error'
      }
    ]
    controller.update(summary2)
    expect(setImage).toHaveBeenCalledWith('icon:error')
    expect(setContextMenu).toHaveBeenCalledTimes(2)
  })
})
