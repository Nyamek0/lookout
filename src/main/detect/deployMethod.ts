import type { DeployMethod, GitInfo } from '../../shared/types'

/** An image reference whose first path segment looks like a registry host (dot or port), not a Docker Hub user. */
function fromRegistry(image: string): boolean {
  const slash = image.indexOf('/')
  if (slash < 0) return false
  const first = image.slice(0, slash)
  return first.includes('.') || first.includes(':')
}

/** A guess, shown to the user as such: nothing on the server records how a deploy happened. */
export function estimateDeployMethod(images: string[], git: GitInfo | null): DeployMethod {
  if (images.some(fromRegistry)) return 'ci-image'
  if (git && git.commit) return 'git-pull'
  return 'file-copy'
}
