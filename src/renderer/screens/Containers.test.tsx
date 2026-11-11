// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContainerInfo, Snapshot } from '../../shared/types'
import { i18n } from '../i18n'
import { Containers } from './Containers'

function fakeSnapshot(containers: ContainerInfo[] = []): Snapshot {
  return {
    serverId: 's1',
    takenAt: Date.now(),
    reachable: true,
    host: {
      cpuPercent: 10,
      memUsedBytes: 1_000_000_000,
      memTotalBytes: 2_000_000_000,
      diskUsedBytes: 5_000_000_000,
      diskTotalBytes: 20_000_000_000,
      uptimeSeconds: 3600,
      cores: 2
    },
    history: { cpu: [], mem: [] },
    projects: [
      {
        id: 'compose:web',
        name: 'web',
        kind: 'compose',
        containerIds: ['c1'],
        domains: [],
        git: null,
        deployMethod: 'ci-image',
        diskBytes: null,
        usage: { cpuPercent: 5, memBytes: 100 },
        status: 'ok'
      }
    ],
    containers,
    undetected: [],
    warnings: [],
    status: 'ok'
  }
}

const c1: ContainerInfo = {
  id: 'c1',
  name: 'web-api-1',
  image: 'node:20-alpine',
  state: 'running',
  exitCode: 0,
  health: 'healthy',
  restartPolicy: 'always',
  publishedPorts: [{ host: 8080, container: 80 }]
}

const c2: ContainerInfo = {
  id: 'c2',
  name: 'standalone-redis',
  image: 'redis:7-alpine',
  state: 'running',
  exitCode: 0,
  restartPolicy: 'unless-stopped',
  publishedPorts: [{ host: 6379, container: 6379 }]
}

describe('Containers', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('shows empty message when there are no containers', () => {
    render(<Containers snapshot={fakeSnapshot([])} onOpenLogs={() => {}} onRestart={() => {}} />)
    expect(screen.getByText(/no containers found/i)).toBeInTheDocument()
  })

  it('lists every container with image, ports, and associated project', () => {
    render(<Containers snapshot={fakeSnapshot([c1, c2])} onOpenLogs={() => {}} onRestart={() => {}} />)

    expect(screen.getByText('web-api-1')).toBeInTheDocument()
    expect(screen.getByText('node:20-alpine')).toBeInTheDocument()
    expect(screen.getByText('8080:80')).toBeInTheDocument()
    expect(screen.getByText('web')).toBeInTheDocument() // project name for c1

    expect(screen.getByText('standalone-redis')).toBeInTheDocument()
    expect(screen.getByText('redis:7-alpine')).toBeInTheDocument()
    expect(screen.getByText(/^standalone$/i)).toBeInTheDocument() // standalone badge for c2
  })

  it('filters containers when typing in the search bar', async () => {
    render(<Containers snapshot={fakeSnapshot([c1, c2])} onOpenLogs={() => {}} onRestart={() => {}} />)

    const searchInput = screen.getByPlaceholderText(/filter containers/i)
    await userEvent.type(searchInput, 'redis')

    expect(screen.getByText('standalone-redis')).toBeInTheDocument()
    expect(screen.queryByText('web-api-1')).not.toBeInTheDocument()
  })

  it('calls onOpenLogs when clicking the logs button', async () => {
    const onOpenLogs = vi.fn()
    render(<Containers snapshot={fakeSnapshot([c1])} onOpenLogs={onOpenLogs} onRestart={() => {}} />)

    const logsBtn = screen.getByRole('button', { name: /logs/i })
    await userEvent.click(logsBtn)

    expect(onOpenLogs).toHaveBeenCalledWith('c1')
  })

  it('calls onRestart when clicking the restart button', async () => {
    const onRestart = vi.fn()
    render(<Containers snapshot={fakeSnapshot([c1])} onOpenLogs={() => {}} onRestart={onRestart} />)

    const restartBtn = screen.getByRole('button', { name: /restart/i })
    await userEvent.click(restartBtn)

    expect(onRestart).toHaveBeenCalledWith(['c1'])
  })
})
