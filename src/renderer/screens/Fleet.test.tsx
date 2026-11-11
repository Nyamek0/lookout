// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ServerConfig, Snapshot } from '../../shared/types'
import '../i18n'
import { Fleet } from './Fleet'

const server1: ServerConfig = { id: 's1', name: 'prod-paris', host: '1.2.3.4', port: 22, user: 'root', authType: 'agent' }
const server2: ServerConfig = { id: 's2', name: 'backup-fra', host: '5.6.7.8', port: 22, user: 'root', authType: 'agent' }

const snapOk: Snapshot = {
  serverId: 's2', takenAt: Date.now() - 5000, reachable: true,
  host: { cpuPercent: 12, memUsedBytes: 2e9, memTotalBytes: 8e9, diskUsedBytes: 20e9, diskTotalBytes: 100e9, uptimeSeconds: 100, cores: 2 },
  history: { cpu: [], mem: [] },
  projects: [{
    id: 'p2', name: 'landing', kind: 'static', containerIds: [], domains: [], git: null, deployMethod: 'file-copy',
    diskBytes: 0, usage: { cpuPercent: 0, memBytes: 0 }, status: 'ok'
  }],
  containers: [], undetected: [], warnings: [], status: 'ok'
}

const snapBad: Snapshot = {
  serverId: 's1', takenAt: Date.now() - 12000, reachable: true,
  host: { cpuPercent: 40, memUsedBytes: 4e9, memTotalBytes: 8e9, diskUsedBytes: 40e9, diskTotalBytes: 100e9, uptimeSeconds: 100, cores: 4 },
  history: { cpu: [], mem: [] },
  projects: [{
    id: 'p1', name: 'api', kind: 'compose', containerIds: ['c1'], domains: [], git: null, deployMethod: 'ci-image',
    diskBytes: 0, usage: { cpuPercent: 0, memBytes: 0 }, status: 'error'
  }],
  containers: [{ id: 'c1', name: 'api-app', image: 'img', state: 'exited', exitCode: 1, restartPolicy: 'always', publishedPorts: [] }],
  undetected: [], warnings: [], status: 'error'
}

describe('Fleet', () => {
  it('displays servers sorted by severity with error first', () => {
    render(
      <Fleet
        servers={[server2, server1]}
        snapshots={{ s1: snapBad, s2: snapOk }}
        onOpenServer={() => {}}
        onOpenProject={() => {}}
        onRetry={() => {}}
      />
    )
    const cards = screen.getAllByTestId('server-card')
    expect(within(cards[0]!).getByText('prod-paris')).toBeInTheDocument()
    expect(within(cards[1]!).getByText('backup-fra')).toBeInTheDocument()
  })

  it('shows an overall banner when all servers are healthy', () => {
    render(
      <Fleet
        servers={[server2]}
        snapshots={{ s2: snapOk }}
        onOpenServer={() => {}}
        onOpenProject={() => {}}
        onRetry={() => {}}
      />
    )
    expect(screen.getByText(/All servers are healthy/i)).toBeInTheDocument()
  })

  it('navigates to server on card click and project on issue click', async () => {
    const onOpenServer = vi.fn()
    const onOpenProject = vi.fn()
    render(
      <Fleet
        servers={[server1]}
        snapshots={{ s1: snapBad }}
        onOpenServer={onOpenServer}
        onOpenProject={onOpenProject}
        onRetry={() => {}}
      />
    )

    await userEvent.click(screen.getByText('api'))
    expect(onOpenProject).toHaveBeenCalledWith('s1', 'p1')

    await userEvent.click(screen.getByText('prod-paris'))
    expect(onOpenServer).toHaveBeenCalledWith('s1')
  })

  it('shows retry button for unreachable servers', async () => {
    const onRetry = vi.fn()
    const snapUnreachable: Snapshot = {
      ...snapBad,
      reachable: false,
      host: null,
      error: { kind: 'network', message: 'Connection refused' }
    }

    render(
      <Fleet
        servers={[server1]}
        snapshots={{ s1: snapUnreachable }}
        onOpenServer={() => {}}
        onOpenProject={() => {}}
        onRetry={onRetry}
      />
    )

    expect(screen.getByText('Connection refused')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledWith('s1')
  })
})
