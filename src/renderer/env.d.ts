/// <reference types="vite/client" />
import type { LookoutApi } from '../shared/ipc'

declare global {
  interface Window {
    lookout: LookoutApi
  }
}
