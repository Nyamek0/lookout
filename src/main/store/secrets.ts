import { Entry } from '@napi-rs/keyring'
import { APP_ID } from '../../shared/brand'

export interface SecretStore {
  get(serverId: string): Promise<string | undefined>
  set(serverId: string, secret: string): Promise<void>
  delete(serverId: string): Promise<void>
}

/** Secrets (passphrases, passwords) live in the OS keychain: Keychain on macOS, Credential Manager on Windows. */
export class KeyringSecretStore implements SecretStore {
  private entry(serverId: string): Entry {
    return new Entry(APP_ID, serverId)
  }

  async get(serverId: string): Promise<string | undefined> {
    return this.entry(serverId).getPassword() ?? undefined
  }

  async set(serverId: string, secret: string): Promise<void> {
    this.entry(serverId).setPassword(secret)
  }

  async delete(serverId: string): Promise<void> {
    try {
      this.entry(serverId).deletePassword()
    } catch {
      // nothing stored for this server
    }
  }
}

export class MemorySecretStore implements SecretStore {
  private readonly secrets = new Map<string, string>()

  async get(serverId: string): Promise<string | undefined> {
    return this.secrets.get(serverId)
  }

  async set(serverId: string, secret: string): Promise<void> {
    this.secrets.set(serverId, secret)
  }

  async delete(serverId: string): Promise<void> {
    this.secrets.delete(serverId)
  }
}
