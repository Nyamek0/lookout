import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ServerConfig } from '../../shared/types'

export class ServerStore {
  private servers: ServerConfig[] = []

  constructor(private readonly file: string) {
    if (!existsSync(file)) return
    try {
      const data: unknown = JSON.parse(readFileSync(file, 'utf8'))
      if (Array.isArray(data)) this.servers = data as ServerConfig[]
    } catch {
      this.servers = []
    }
  }

  list(): ServerConfig[] {
    return [...this.servers]
  }

  add(input: Omit<ServerConfig, 'id'>): ServerConfig {
    const server: ServerConfig = { ...input, id: randomUUID() }
    this.servers.push(server)
    this.save()
    return server
  }

  remove(id: string): void {
    this.servers = this.servers.filter((s) => s.id !== id)
    this.save()
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.servers, null, 2))
    renameSync(tmp, this.file)
  }
}
