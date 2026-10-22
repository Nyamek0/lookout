import { posix } from 'node:path'

function isSafe(path: string): boolean {
  return (
    posix.isAbsolute(path) &&
    !path.includes('\0') &&
    !path.split('/').includes('..') &&
    posix.normalize(path) === path
  )
}

/** Paths the app discovered itself (docker labels, known locations); the only ones it may read. */
export class PathRegistry {
  private readonly paths = new Set<string>()

  register(path: string): void {
    if (isSafe(path)) this.paths.add(path.replace(/\/+$/, '') || '/')
  }

  isAllowed(path: string): boolean {
    return isSafe(path) && this.paths.has(path.replace(/\/+$/, '') || '/')
  }
}
