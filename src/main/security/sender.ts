/** True only for the app's own page: the packaged file, or the dev server's origin while developing. */
export function isTrustedUrl(url: string | undefined, o: { appFileUrl: string; devUrl?: string }): boolean {
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (o.devUrl && parsed.origin === new URL(o.devUrl).origin) return true
  parsed.hash = ''
  parsed.search = ''
  return parsed.href === o.appFileUrl
}
