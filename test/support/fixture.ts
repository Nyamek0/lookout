import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Reads a captured command output from test/fixtures. Tests run from the repository root. */
export function fixture(name: string): string {
  return readFileSync(join(process.cwd(), 'test', 'fixtures', name), 'utf8')
}
