import { describe, expect, it } from 'vitest'
import { isTrustedUrl } from './sender'

const APP = 'file:///Applications/lookout.app/Contents/Resources/app.asar/out/renderer/index.html'

describe('isTrustedUrl', () => {
  it('accepts only the app page when packaged, ignoring hash and query', () => {
    expect(isTrustedUrl(APP, { appFileUrl: APP })).toBe(true)
    expect(isTrustedUrl(`${APP}#/x?y=1`, { appFileUrl: APP })).toBe(true)
    expect(isTrustedUrl('file:///etc/passwd', { appFileUrl: APP })).toBe(false)
    expect(isTrustedUrl('file:///tmp/evil/renderer/index.html', { appFileUrl: APP })).toBe(false)
    expect(isTrustedUrl('https://evil.example', { appFileUrl: APP })).toBe(false)
  })
  it('accepts only the dev server origin in development', () => {
    const o = { appFileUrl: APP, devUrl: 'http://localhost:5173' }
    expect(isTrustedUrl('http://localhost:5173/', o)).toBe(true)
    expect(isTrustedUrl('http://localhost:5173/index.html', o)).toBe(true)
    expect(isTrustedUrl('http://localhost:5174/', o)).toBe(false)
    expect(isTrustedUrl('http://evil.example/', o)).toBe(false)
  })
  it('refuses a missing or malformed url', () => {
    expect(isTrustedUrl(undefined, { appFileUrl: APP })).toBe(false)
    expect(isTrustedUrl('not a url', { appFileUrl: APP })).toBe(false)
  })
})
