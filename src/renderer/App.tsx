import { useEffect, useState } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { ConfirmDialog } from './components/ConfirmDialog'
import { HostKeyPrompt } from './components/HostKeyPrompt'
import { LogViewer } from './components/LogViewer'
import { Shell } from './components/Shell'
import { i18n } from './i18n'
import { AddServer } from './screens/AddServer'
import { Home } from './screens/Home'
import { ProjectPage } from './screens/ProjectPage'
import { Projects } from './screens/Projects'
import { useAppStore } from './state/store'
import { useRestart } from './state/useRestart'

type View = { name: 'overview' } | { name: 'projects' } | { name: 'project'; id: string } | { name: 'add' }

function Content() {
  const { t } = useTranslation()
  const { servers, snapshots, activeId, init, select, refreshServers } = useAppStore()
  const [view, setView] = useState<View>({ name: 'overview' })
  const [logsFor, setLogsFor] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const restart = useRestart(activeId ?? '')

  useEffect(() => {
    let off = () => {}
    let stopped = false
    void init().then((unsubscribe) => (stopped ? unsubscribe() : (off = unsubscribe)))
    void window.lookout.settings.getLanguage().then((language) => i18n.changeLanguage(language))
    return () => {
      stopped = true
      off()
    }
  }, [init])

  const entries = servers.map((s) => ({ id: s.id, name: s.name, status: snapshots[s.id]?.status ?? ('neutral' as const) }))
  const snapshot = activeId ? snapshots[activeId] : undefined

  const choose = (id: string) => {
    select(id)
    setView({ name: 'overview' })
    setLogsFor(null)
  }

  const added = async () => {
    await refreshServers()
    const state = useAppStore.getState()
    if (!state.activeId && state.servers[0]) state.select(state.servers[0].id)
    setView({ name: 'overview' })
  }

  const tab = (name: 'overview' | 'projects', label: string) => (
    <button
      type="button"
      onClick={() => {
        setView(name === 'overview' ? { name: 'overview' } : { name: 'projects' })
        setLogsFor(null)
      }}
      aria-current={view.name === name ? 'page' : undefined}
      className={`border-b px-1 pb-2 text-sm ${view.name === name ? 'border-fg text-fg' : 'border-transparent text-dim hover:text-fg'}`}
    >
      {label}
    </button>
  )

  let body
  if (view.name === 'add') {
    body = <AddServer onDone={() => void added()} onCancel={() => setView({ name: 'overview' })} />
  } else if (servers.length === 0) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <h1 className="text-2xl font-semibold">{t('app.name')}</h1>
        <p className="text-sm text-dim">{t('app.tagline')}</p>
        <p className="text-sm text-dim">{t('nav.welcome')}</p>
      </div>
    )
  } else if (!snapshot) {
    body = <p className="text-sm text-dim">{t('nav.connecting')}</p>
  } else {
    const project = view.name === 'project' ? snapshot.projects.find((p) => p.id === view.id) : undefined
    const projectContainers = project
      ? snapshot.containers.filter((c) => project.containerIds.includes(c.id)).map((c) => ({ id: c.id, name: c.name }))
      : []
    body = (
      <div className="flex flex-col gap-5">
        <nav className="flex gap-5 border-b border-line">
          {tab('overview', t('nav.overview'))}
          {tab('projects', t('nav.projects'))}
        </nav>
        {view.name === 'overview' && <Home snapshot={snapshot} onOpenProject={(id) => setView({ name: 'project', id })} />}
        {view.name === 'projects' && <Projects snapshot={snapshot} onOpen={(id) => setView({ name: 'project', id })} />}
        {view.name === 'project' && (
          <>
            <ProjectPage
              snapshot={snapshot}
              projectId={view.id}
              onOpenLogs={setLogsFor}
              onRestart={(ids) => void restart.request(ids)}
            />
            {logsFor && projectContainers.length > 0 && (
              <LogViewer
                serverId={snapshot.serverId}
                containers={projectContainers}
                initialContainerId={logsFor}
                fullscreen={fullscreen}
                onToggleFullscreen={() => setFullscreen((f) => !f)}
              />
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <Shell servers={entries} activeId={activeId} onSelect={choose} onAdd={() => setView({ name: 'add' })}>
        {restart.result && (
          <div
            role="status"
            className={`mb-4 flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
              restart.result.ok ? 'border-ok/60 text-ok' : 'border-bad/60 text-bad'
            }`}
          >
            <span>{restart.result.ok ? t('restart.done') : t('restart.failed', { stderr: restart.result.stderr })}</span>
            <button type="button" onClick={restart.dismiss} className="underline">
              {t('restart.dismiss')}
            </button>
          </div>
        )}
        {body}
      </Shell>
      {restart.pending && (
        <ConfirmDialog
          title={restart.pending.label}
          body={t('restart.body')}
          command={restart.pending.command}
          confirmLabel={t('restart.confirm')}
          cancelLabel={t('restart.cancel')}
          onConfirm={() => void restart.confirm()}
          onCancel={restart.cancel}
        />
      )}
      <HostKeyPrompt />
    </>
  )
}

export function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Content />
    </I18nextProvider>
  )
}
