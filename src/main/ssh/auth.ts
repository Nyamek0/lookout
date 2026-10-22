import type { ServerConfig } from '../../shared/types'
import type { Auth } from './connection'

/** Builds the SSH credentials of a saved server from its config and the secret held in the keychain. */
export function authFor(server: ServerConfig, secret: string | undefined): Auth {
  switch (server.authType) {
    case 'agent':
      return { type: 'agent' }
    case 'key':
      if (!server.keyPath) throw new Error(`Server "${server.name}" uses a key but has no key file`)
      return secret ? { type: 'key', path: server.keyPath, passphrase: secret } : { type: 'key', path: server.keyPath }
    case 'password':
      if (!secret) throw new Error(`No password stored for server "${server.name}"`)
      return { type: 'password', password: secret }
  }
}
