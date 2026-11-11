import { describe, expect, it, vi } from 'vitest'
import { checkForUpdates } from './checker'

describe('checkForUpdates', () => {
  it('returns hasUpdate: true when latest release is newer than current', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.2.0',
        name: 'v0.2.0',
        html_url: 'https://github.com/Nyamek0/lookout/releases/tag/v0.2.0',
        published_at: '2026-11-11T14:21:57Z'
      })
    })

    const result = await checkForUpdates({
      currentVersion: '0.1.1',
      fetchImpl: fetchMock as unknown as typeof fetch
    })

    expect(result).toEqual({
      currentVersion: '0.1.1',
      latestVersion: '0.2.0',
      hasUpdate: true,
      releaseUrl: 'https://github.com/Nyamek0/lookout/releases/tag/v0.2.0',
      name: 'v0.2.0',
      publishedAt: '2026-11-11T14:21:57Z'
    })
  })

  it('returns hasUpdate: false when current version is equal or newer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v0.2.0',
        name: 'v0.2.0',
        html_url: 'https://github.com/Nyamek0/lookout/releases/tag/v0.2.0'
      })
    })

    const result = await checkForUpdates({
      currentVersion: '0.2.0',
      fetchImpl: fetchMock as unknown as typeof fetch
    })

    expect(result.hasUpdate).toBe(false)
    expect(result.latestVersion).toBe('0.2.0')
  })

  it('handles network failure gracefully without throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await checkForUpdates({
      currentVersion: '0.1.1',
      fetchImpl: fetchMock as unknown as typeof fetch
    })

    expect(result).toEqual({
      currentVersion: '0.1.1',
      latestVersion: '0.1.1',
      hasUpdate: false,
      releaseUrl: 'https://github.com/Nyamek0/lookout/releases'
    })
  })

  it('handles non-200 responses gracefully without throwing', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404
    })

    const result = await checkForUpdates({
      currentVersion: '0.1.1',
      fetchImpl: fetchMock as unknown as typeof fetch
    })

    expect(result.hasUpdate).toBe(false)
  })
})

