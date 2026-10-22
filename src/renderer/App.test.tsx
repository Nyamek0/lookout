// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_NAME } from '../shared/brand'
import type { LookoutApi } from '../shared/ipc'
import type { ContainerInfo, PreparedAction, Project, ServerConfig, Snapshot } from '../shared/types'
import { App } from './App'
import { useAppStore } from './state/store'

const GiB = 1024 ** 3
const server: ServerConfig = { id: 's1', name: 'vps-main', host: '1.2.3.4', port: 22, user: 'root', authType: 'agent' }
const container: ContainerInfo = {
  id: 'abcdef123456', name: 'backend-api-1', image: 'backend-api', service: 'api', composeProject: 'backend',
  state: 'running', exitCode: 0, restartPolicy: 'always', publishedPorts: []
}
const project: Project = {
  id: 'compose:backend', name: 'backend', kind: 'compose', containerIds: ['abcdef123456'], domains: [], git: null,
  deployMethod: 'file-copy', diskBytes: GiB, usage: { cpuPercent: 3, memBytes: 2 * GiB }, status: 'ok'
}
const snapshot: Snapshot = {
  serverId: 's1', takenAt: 1, reachable: true,
  host: { cpuPercent: 16, memUsedBytes: 6 * GiB, memTotalBytes: 11 * GiB, diskUsedBytes: 70 * GiB, diskTotalBytes: 197 * GiB, uptimeSeconds: 1, cores: 6 },
  history: { cpu: [10, 16], mem: [50, 55] }, projects: [project], containers: [container], undetected: [], warnings: [], status: 'ok'
}

let push: (s: Snapshot) => void = () => {}
const prepareRestart = vi.fn(async (_s: string, ids: string[]): Promise<PreparedAction> => ({
  actionId: 'act-1', serverId: 's1', label: 'Restart 1 container', command: `docker restart ${ids.join(' ')}`, expiresAt: 1
}))
const confirm = vi.fn(async (_id: string) => ({ ok: true, stderr: '' }))

const retry = vi.fn(async (_id: string) => {})
const remove = vi.fn(async (_id: string) => {})

function installApi(servers: ServerConfig[]) {
  window.lookout = {
    servers: { list: async () => servers, importSshConfig: async () => [], add: vi.fn(), remove },
    monitor: { onSnapshot: (cb: (s: Snapshot) => void) => ((push = cb), () => {}), setActive: async () => {}, retry },
    hostKey: { onPrompt: () => () => {}, onChanged: () => () => {}, answer: async () => {} },
    logs: { fetch: async () => ({ lines: [], oldest: undefined }), follow: async () => () => {} },
    actions: { prepareRestart, confirm },
    settings: { getLanguage: async () => 'en', setLanguage: async () => {} }
  } as unknown as LookoutApi
}

beforeEach(() => {
  prepareRestart.mockClear()
  confirm.mockClear()
  retry.mockClear()
  remove.mockClear()
  useAppStore.setState({ servers: [], snapshots: {}, activeId: null, projectHistory: {} })
})

describe('App', () => {
  it('invites you to add your first server when there is none', async () => {
    installApi([])
    render(<App />)
    expect(await screen.findByText(APP_NAME)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Add a server' })[0]!)
    expect(await screen.findByRole('heading', { name: 'Add a server' })).toBeInTheDocument()
  })

  it('walks from the overview to a project and restarts it only after confirmation', async () => {
    installApi([server])
    render(<App />)
    await screen.findByText('vps-main')
    act(() => push(snapshot))
    await userEvent.click(await screen.findByText('backend'))

    await userEvent.click(await screen.findByRole('button', { name: 'Restart' }))
    expect(prepareRestart).toHaveBeenCalledWith('s1', ['abcdef123456'])
    expect(await screen.findByText('docker restart abcdef123456')).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(confirm).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Restart' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(confirm).toHaveBeenCalledWith('act-1'))
    expect(await screen.findByText(/Restarted/)).toBeInTheDocument()
  })

  it('names the server and the containers in the restart confirmation', async () => {
    installApi([server])
    render(<App />)
    await screen.findByText('vps-main')
    act(() => push(snapshot))
    await userEvent.click(await screen.findByText('backend'))
    await userEvent.click(await screen.findByRole('button', { name: 'Restart' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/vps-main/)).toBeInTheDocument()
    expect(within(dialog).getByText(/backend-api-1/)).toBeInTheDocument()
  })

  it('shows why a server is unreachable, retries on request, and removes it after confirmation', async () => {
    installApi([server])
    render(<App />)
    await screen.findByText('vps-main')
    act(() =>
      push({ ...snapshot, reachable: false, host: null, status: 'error', projects: [], containers: [],
        error: { kind: 'auth', message: 'All configured authentication methods failed' } })
    )
    expect(await screen.findByText(/Sign-in failed/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledWith('s1')

    await userEvent.click(screen.getByRole('button', { name: 'Remove server' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Nothing is changed on the server/)).toBeInTheDocument()
    expect(remove).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith('s1'))
  })

  it('opens the logs of the project from its page', async () => {
    installApi([server])
    render(<App />)
    await screen.findByText('vps-main')
    act(() => push(snapshot))
    await userEvent.click(await screen.findByText('backend'))
    await userEvent.click(await screen.findByRole('button', { name: 'Logs' }))
    expect(await screen.findByRole('tab', { name: 'backend-api-1' })).toBeInTheDocument()
  })
})
