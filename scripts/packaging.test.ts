import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_ID, APP_NAME } from '../src/shared/brand'

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

// The product name is provisional: these checks make a rename a one-place change that cannot be half-done.
describe('product name stays in sync', () => {
  it('uses the same app id and name in the packaging config', () => {
    const config = read('electron-builder.yml')
    expect(/^appId:\s*(\S+)/m.exec(config)?.[1]).toBe(APP_ID)
    expect(/^productName:\s*(\S+)/m.exec(config)?.[1]).toBe(APP_NAME)
  })
  it('uses the same name in package.json', () => {
    expect((JSON.parse(read('package.json')) as { name: string }).name).toBe(APP_NAME)
  })
})

describe('release packaging', () => {
  it('names every installer with the system and the architecture, so people pick the right download', () => {
    const config = read('electron-builder.yml')
    expect(config).toMatch(/^artifactName:\s*\$\{productName\}-\$\{version\}-\$\{os\}-\$\{arch\}\.\$\{ext\}/m)
  })

  it('has a version that releases can be tagged with', () => {
    expect((JSON.parse(read('package.json')) as { version: string }).version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  // electron-builder turns build/icon.png into the .icns and .ico files; without it every installer carries the Electron logo
  it('ships an app icon big enough to make the icons of every system', () => {
    const icon = readFileSync(join(process.cwd(), 'build/icon.png'))
    expect(icon.subarray(1, 4).toString('latin1')).toBe('PNG')
    // the first chunk (IHDR) holds the width and the height as two big-endian integers
    expect(icon.readUInt32BE(16)).toBeGreaterThanOrEqual(512)
    expect(icon.readUInt32BE(20)).toBeGreaterThanOrEqual(512)
  })

  it('only signs mac apps ad hoc: other systems are left untouched', async () => {
    const require = createRequire(import.meta.url)
    const afterPack = (require('./afterPack.cjs') as { default: (c: unknown) => Promise<void> }).default
    await expect(afterPack({ electronPlatformName: 'win32', appOutDir: '/nowhere', packager: {} })).resolves.toBeUndefined()
    expect(read('electron-builder.yml')).toMatch(/^afterPack:\s*scripts\/afterPack\.cjs/m)
  })

  it('builds the release from a tag, on one runner per installer, and publishes only as a draft', () => {
    const workflow = read('.github/workflows/release.yml')
    expect(workflow).toMatch(/tags:\s*\n\s*-\s*'v\*'/)
    for (const target of ['mac-arm64', 'mac-x64', 'win-x64']) expect(workflow).toContain(target)
    expect(workflow).toMatch(/gh release create[^\n]*--draft/)
    expect(workflow).toContain('SHA256SUMS')
    expect(workflow).toContain('SMOKE_APP') // the packaged app is exercised before it is offered for download
    // the tag name reaches the shell through the environment, never pasted into the script
    expect(workflow).not.toMatch(/run:[^\n]*\$\{\{\s*github\.ref_name/)
  })

  it('tells people how to open an unsigned build', () => {
    const readme = read('README.md')
    expect(readme).toContain('releases/latest')
    expect(readme).toContain('xattr -cr')
    expect(readme).toMatch(/SmartScreen/)
  })
})
