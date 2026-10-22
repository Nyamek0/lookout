import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ServerStore } from './serverStore'

const tmp = () => join(mkdtempSync(join(tmpdir(), 'lookout-')), 'servers.json')
const input = { name: 'vps', host: '1.2.3.4', port: 22, user: 'root', authType: 'password' as const }

describe('ServerStore', () => {
  it('persists servers with unique ids across instances', () => {
    const file = tmp()
    const a = new ServerStore(file).add(input)
    const b = new ServerStore(file).add({ ...input, name: 'second' })
    expect(a.id).not.toBe(b.id)
    expect(new ServerStore(file).list().map((s) => s.name)).toEqual(['vps', 'second'])
  })

  it('never writes secrets to disk', () => {
    const file = tmp()
    new ServerStore(file).add({ ...input, authType: 'password' })
    const raw = readFileSync(file, 'utf8').toLowerCase()
    expect(raw).not.toContain('passphrase')
    expect(raw).not.toContain('"password"')
    expect(raw).not.toContain('private key')
  })

  it('removes a server', () => {
    const store = new ServerStore(tmp())
    const s = store.add(input)
    store.remove(s.id)
    expect(store.list()).toEqual([])
  })

  it('treats a corrupt file as empty', () => {
    const file = tmp()
    writeFileSync(file, '{not json')
    expect(new ServerStore(file).list()).toEqual([])
  })
})
