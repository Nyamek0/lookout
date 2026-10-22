import { caddyProvider } from './caddy'
import { nginxProvider } from './nginx'
import type { ProxyProvider } from './proxy'

/** Every reverse proxy the app can read. Add a provider here to support a new one. */
export const proxyProviders: ProxyProvider[] = [caddyProvider, nginxProvider]
