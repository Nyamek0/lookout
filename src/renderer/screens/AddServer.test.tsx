// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LookoutApi } from '../../shared/ipc'
import type { SshHost } from '../../shared/types'
import '../i18n'
import { AddServer } from './AddServer'

const hosts: SshHost[] = [
  { alias: 'vps', hostName: '203.0.113.10', user: 'root', port: 22 },
  { alias: 'api', hostName: 'api.example.com', user: 'deploy', port: 2222, identityFile: '~/.ssh/id_api' },
  { alias: 'inner', hostName: '10.0.0.2', port: 22, proxyJump: 'bastion' }
]

const add = vi.fn(async (i) => ({ id: 'new', ...i }))

beforeEach(() => {
  add.mockClear()
  window.lookout = {
    servers: { importSshConfig: async () => hosts, add }
  } as unknown as LookoutApi
})

describe('AddServer', () => {
  it('lists hosts from ssh config and pre-fills the form from one', async () => {
    render(<AddServer onDone={() => {}} onCancel={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'vps' }))
    expect(screen.getByLabelText('Host')).toHaveValue('203.0.113.10')
    expect(screen.getByLabelText('User')).toHaveValue('root')
    expect(screen.getByLabelText('Port')).toHaveValue(22)
    expect(screen.getByLabelText('Name')).toHaveValue('vps')
  })

  it('uses key authentication when the ssh config names an identity file', async () => {
    render(<AddServer onDone={() => {}} onCancel={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'api' }))
    expect(screen.getByLabelText('Authentication')).toHaveValue('key')
    expect(screen.getByLabelText('Key file')).toHaveValue('~/.ssh/id_api')
  })

  it('sends a password as a secret and calls onDone', async () => {
    const onDone = vi.fn()
    render(<AddServer onDone={onDone} onCancel={() => {}} />)
    await userEvent.type(await screen.findByLabelText('Name'), 'prod')
    await userEvent.type(screen.getByLabelText('Host'), '1.2.3.4')
    await userEvent.type(screen.getByLabelText('User'), 'root')
    await userEvent.selectOptions(screen.getByLabelText('Authentication'), 'password')
    const pw = screen.getByLabelText('Password')
    expect(pw).toHaveAttribute('type', 'password')
    await userEvent.type(pw, 'hunter2')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(add).toHaveBeenCalledWith({
      name: 'prod', host: '1.2.3.4', port: 22, user: 'root', authType: 'password', secret: 'hunter2'
    })
  })

  it('says that root works but a dedicated user is safer, only for root', async () => {
    render(<AddServer onDone={() => {}} onCancel={() => {}} />)
    const user = await screen.findByLabelText('User')
    expect(screen.queryByText(/dedicated user/i)).toBeNull()
    await userEvent.type(user, 'root')
    expect(screen.getByText(/dedicated user/i)).toBeInTheDocument()
    await userEvent.clear(user)
    await userEvent.type(user, 'deploy')
    expect(screen.queryByText(/dedicated user/i)).toBeNull()
  })

  it('blocks a host that needs ProxyJump and says so', async () => {
    render(<AddServer onDone={() => {}} onCancel={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: 'inner' }))
    expect(screen.getByText(/ProxyJump is not supported yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('shows an error and stays open when adding fails', async () => {
    add.mockRejectedValueOnce(new Error('boom'))
    const onDone = vi.fn()
    render(<AddServer onDone={onDone} onCancel={() => {}} />)
    await userEvent.type(await screen.findByLabelText('Name'), 'x')
    await userEvent.type(screen.getByLabelText('Host'), 'h')
    await userEvent.type(screen.getByLabelText('User'), 'u')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/boom/)).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
