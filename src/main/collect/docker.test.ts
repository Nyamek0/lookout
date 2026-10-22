import { describe, expect, it } from 'vitest'
import { fixture } from '../../../test/support/fixture'
import {
  ParseError,
  classifyDockerError,
  parseDockerInspect,
  parseDockerStats,
  parseDockerSystemDf,
  parseSize
} from './docker'

describe('parseDockerInspect', () => {
  const containers = parseDockerInspect(fixture('docker-inspect.json'))

  it('reads compose metadata, health and restart policy', () => {
    const q = containers.find((c) => c.name === 'shop-queue-1')!
    expect(q).toMatchObject({
      id: 'd58c008e9380',
      composeProject: 'shop',
      service: 'queue',
      workingDir: '/opt/shop',
      configFiles: ['/opt/shop/docker-compose.yml', '/opt/shop/docker-compose.prod.yml'],
      state: 'running',
      health: 'healthy',
      restartPolicy: 'unless-stopped',
      image: 'ghcr.io/acme/shop-app:sha-c6b18ce'
    })
    expect(q.publishedPorts).toEqual([])
  })

  it('reads published ports once, ignoring the ipv6 duplicate', () => {
    expect(containers.find((c) => c.name === 'backend-api-1')!.publishedPorts).toEqual([
      { host: 8000, container: 8000 }
    ])
  })

  it('handles a container without compose labels and an empty restart policy', () => {
    const c = containers.find((x) => x.name === 'one-shot')!
    expect(c.composeProject).toBeUndefined()
    expect(c).toMatchObject({ state: 'exited', exitCode: 1, restartPolicy: 'no' })
  })

  it('returns [] for empty output and throws a ParseError for truncated JSON', () => {
    expect(parseDockerInspect('')).toEqual([])
    expect(parseDockerInspect('[]')).toEqual([])
    expect(() => parseDockerInspect('[{"Id":')).toThrow(ParseError)
  })
})

describe('parseDockerStats / parseSize', () => {
  it('reads cpu percent and memory bytes keyed by short id', () => {
    const stats = parseDockerStats(fixture('docker-stats.txt'))
    expect(stats['abc123def456']).toEqual({ cpuPercent: 1.5, memBytes: 125829120 })
    expect(stats['d58c008e9380']!.cpuPercent).toBe(0.23)
  })

  it('parses decimal and binary units', () => {
    expect(parseSize('787.2kB')).toBe(787200)
    expect(parseSize('878MB')).toBe(878_000_000)
    expect(parseSize('1.5GiB')).toBe(1610612736)
    expect(parseSize('0B')).toBe(0)
    expect(parseSize('garbage')).toBe(0)
  })
})

describe('parseDockerSystemDf', () => {
  it('reads volume and image sizes', () => {
    const df = parseDockerSystemDf(fixture('docker-system-df.json'))
    expect(df.volumes['shop_uploads_photo']).toBe(787200)
    expect(df.volumes['backend_postgres_data']).toBe(1_200_000_000)
    expect(df.images['ghcr.io/acme/shop-app:sha-c6b18ce']).toBe(432_000_000)
  })

  it('returns empty maps on junk input', () => {
    expect(parseDockerSystemDf('nope')).toEqual({ volumes: {}, images: {} })
  })
})

describe('classifyDockerError', () => {
  it('recognises permission and availability problems', () => {
    expect(
      classifyDockerError('permission denied while trying to connect to the Docker daemon socket')
    ).toBe('permission_denied')
    expect(classifyDockerError('Cannot connect to the Docker daemon at unix:///var/run/docker.sock')).toBe(
      'docker_unavailable'
    )
    expect(classifyDockerError('sh: 1: docker: command not found')).toBe('docker_unavailable')
    expect(classifyDockerError('')).toBeNull()
  })
})
