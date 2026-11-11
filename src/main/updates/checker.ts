import { isNewerVersion, parseSemver } from '../../shared/semver'
import type { UpdateInfo } from '../../shared/types'

const DEFAULT_REPO = 'Nyamek0/lookout'

export async function checkForUpdates(opts: {
  currentVersion: string
  fetchImpl?: typeof fetch
  repo?: string
}): Promise<UpdateInfo> {
  const currentVersion = opts.currentVersion.trim()
  const fetchFn = opts.fetchImpl ?? fetch
  const repo = opts.repo ?? DEFAULT_REPO
  const fallbackUrl = `https://github.com/${repo}/releases`

  try {
    const res = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'lookout-app'
      }
    })

    if (!res.ok) {
      return {
        currentVersion,
        latestVersion: currentVersion,
        hasUpdate: false,
        releaseUrl: fallbackUrl
      }
    }

    const data = (await res.json()) as {
      tag_name?: string
      name?: string
      html_url?: string
      published_at?: string
    }

    const rawTag = data.tag_name ?? ''
    const parsed = parseSemver(rawTag)
    const latestVersion = parsed ? `${parsed.major}.${parsed.minor}.${parsed.patch}` : currentVersion
    const hasUpdate = isNewerVersion(rawTag, currentVersion)

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseUrl: data.html_url ?? fallbackUrl,
      name: data.name,
      publishedAt: data.published_at
    }
  } catch {
    return {
      currentVersion,
      latestVersion: currentVersion,
      hasUpdate: false,
      releaseUrl: fallbackUrl
    }
  }
}

