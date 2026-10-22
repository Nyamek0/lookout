import { readFileSync } from 'node:fs'
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
