import type { ConnectErrorKind } from '../../shared/types'
import { HostKeyChangedError } from './hostKeys'

const NETWORK_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN'])

/** Sorts a failed connection into "try again later" (network) or "wait for the user" (auth, host key). */
export function classifyConnectError(e: unknown): { kind: ConnectErrorKind; message: string } {
  const message = e instanceof Error ? e.message : String(e)
  if (e instanceof HostKeyChangedError) return { kind: 'hostkey-changed', message }
  if (/was not trusted/i.test(message)) return { kind: 'hostkey-refused', message }
  const props = e as { level?: unknown; code?: unknown }
  if (
    props?.level === 'client-authentication' ||
    /authentication methods failed|No password stored|has no key file/i.test(message)
  ) {
    return { kind: 'auth', message }
  }
  if ((typeof props?.code === 'string' && NETWORK_CODES.has(props.code)) || /timed out while waiting for handshake/i.test(message)) {
    return { kind: 'network', message }
  }
  return { kind: 'other', message }
}
