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
    // Whitelist the fields: anything else (a stray secret) never reaches the disk.
    const server: ServerConfig = {
      id: randomUUID(),
      name: input.name,
      host: input.host,
      port: input.port,
      user: input.user,
      authType: input.authType,
      ...(input.keyPath ? { keyPath: input.keyPath } : {})
    }
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
