// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContainerInfo, Project, Snapshot } from '../../shared/types'
import { i18n } from '../i18n'
import { Databases } from './Databases'

function fakeSnapshot(containers: ContainerInfo[] = [], projects: Project[] = []): Snapshot {
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
    projects,
    containers,
    undetected: [],
    warnings: [],
    status: 'ok'
  }
}

const pg: ContainerInfo = {
  id: 'pg1',
  name: 'prod-postgres',
  image: 'postgres:16-alpine',
  state: 'running',
  exitCode: 0,
  health: 'healthy',
  restartPolicy: 'always',
  publishedPorts: [{ host: 5432, container: 5432 }]
}

const webProject: Project = {
  id: 'compose:web',
  name: 'web-store',
  kind: 'compose',
  containerIds: ['pg1'],
  domains: [],
  git: null,
  deployMethod: 'ci-image',
  diskBytes: 250_000_000,
  usage: { cpuPercent: 5, memBytes: 100 },
  status: 'ok'
}

describe('Databases', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('shows empty message when no database is detected', () => {
    render(<Databases snapshot={fakeSnapshot([])} />)
    expect(screen.getByText(/no databases detected/i)).toBeInTheDocument()
  })

  it('displays detected database cards with engine badge, name, ports and volume', () => {
    render(<Databases snapshot={fakeSnapshot([pg], [webProject])} />)

    expect(screen.getByText('PostgreSQL')).toBeInTheDocument()
    expect(screen.getByText('prod-postgres')).toBeInTheDocument()
    expect(screen.getByText('5432')).toBeInTheDocument()
    expect(screen.getByText('web-store')).toBeInTheDocument()
    expect(screen.getByText(/238(\.4)? MB/)).toBeInTheDocument()
  })

  it('calls onOpenLogs when clicking the logs button', async () => {
    const onOpenLogs = vi.fn()
    render(<Databases snapshot={fakeSnapshot([pg], [webProject])} onOpenLogs={onOpenLogs} />)

    const logsBtn = screen.getByRole('button', { name: /logs/i })
    await userEvent.click(logsBtn)

    expect(onOpenLogs).toHaveBeenCalledWith('pg1')
  })

  it('calls onOpenProject when clicking the project link', async () => {
    const onOpenProject = vi.fn()
    render(<Databases snapshot={fakeSnapshot([pg], [webProject])} onOpenProject={onOpenProject} />)

    const projectLink = screen.getByRole('button', { name: 'web-store' })
    await userEvent.click(projectLink)

    expect(onOpenProject).toHaveBeenCalledWith('compose:web')
  })
})

