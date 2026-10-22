import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { NewServerInput } from '../../shared/ipc'
import type { ServerConfig, SshHost } from '../../shared/types'

type AuthType = ServerConfig['authType']

const input = 'w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm text-fg outline-none focus:border-dim'
const labelCls = 'flex flex-col gap-1 text-xs text-dim'

export function AddServer({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const [hosts, setHosts] = useState<SshHost[]>([])
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState(22)
  const [user, setUser] = useState('')
  const [authType, setAuthType] = useState<AuthType>('agent')
  const [keyPath, setKeyPath] = useState('')
  const [secret, setSecret] = useState('')
  const [proxyJump, setProxyJump] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.lookout.servers
      .importSshConfig()
      .then(setHosts)
      .catch(() => setHosts([]))
  }, [])

  const fill = (h: SshHost) => {
    setName(h.alias)
    setHost(h.hostName)
    setUser(h.user ?? '')
    setPort(h.port)
    setAuthType(h.identityFile ? 'key' : 'agent')
    setKeyPath(h.identityFile ?? '')
    setProxyJump(Boolean(h.proxyJump))
  }

  const valid = name.trim() !== '' && host.trim() !== '' && user.trim() !== '' && !proxyJump

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    const payload: NewServerInput = {
      name: name.trim(),
      host: host.trim(),
      port,
      user: user.trim(),
      authType,
      ...(authType === 'key' && keyPath ? { keyPath } : {}),
      ...(authType !== 'agent' && secret ? { secret } : {})
    }
    setBusy(true)
    setError(null)
    try {
      await window.lookout.servers.add(payload)
      onDone()
    } catch (err) {
      setError(t('addServer.failed', { message: err instanceof Error ? err.message : String(err) }))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">{t('addServer.title')}</h1>

      {hosts.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-dim">{t('addServer.fromSshConfig')}</h2>
          <div className="flex flex-wrap gap-2">
            {hosts.map((h) => (
              <button
                key={h.alias}
                type="button"
                onClick={() => fill(h)}
                className="rounded-md border border-line px-3 py-1 text-sm hover:bg-panel"
              >
                {h.alias}
              </button>
            ))}
          </div>
        </section>
      )}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-dim">{t('addServer.details')}</h2>
        <label className={labelCls}>
          {t('addServer.name')}
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <label className={labelCls}>
            {t('addServer.host')}
            <input className={input} value={host} onChange={(e) => setHost(e.target.value)} />
          </label>
          <label className={labelCls}>
            {t('addServer.port')}
            <input className={input} type="number" value={port} onChange={(e) => setPort(Number(e.target.value) || 22)} />
          </label>
        </div>
        <label className={labelCls}>
          {t('addServer.user')}
          <input className={input} value={user} onChange={(e) => setUser(e.target.value)} />
        </label>
        <label className={labelCls}>
          {t('addServer.auth')}
          <select className={input} value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
            <option value="agent">{t('addServer.authAgent')}</option>
            <option value="key">{t('addServer.authKey')}</option>
            <option value="password">{t('addServer.authPassword')}</option>
          </select>
        </label>
        {authType === 'key' && (
          <>
            <label className={labelCls}>
              {t('addServer.keyPath')}
              <input className={input} value={keyPath} onChange={(e) => setKeyPath(e.target.value)} />
            </label>
            <label className={labelCls}>
              {t('addServer.passphrase')}
              <input className={input} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
            </label>
          </>
        )}
        {authType === 'password' && (
          <label className={labelCls}>
            {t('addServer.password')}
            <input className={input} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </label>
        )}

        {user.trim() === 'root' && <p className="text-xs text-dim">{t('addServer.rootNote')}</p>}
        {proxyJump && <p className="text-sm text-warn">{t('addServer.proxyJump')}</p>}
        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-panel">
            {t('addServer.cancel')}
          </button>
          <button
            type="submit"
            disabled={!valid || busy}
            className="rounded-md bg-fg px-3 py-1.5 text-sm text-ink disabled:opacity-40"
          >
            {t('addServer.add')}
          </button>
        </div>
      </form>
    </div>
  )
}
