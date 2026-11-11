import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_PREFERENCES, type Preferences, type PreferencesPatch } from '../../shared/types'

type Language = Preferences['language']
type Listener = (preferences: Preferences) => void

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

/** Whatever is on disk (an older version, a hand edit), keep only well-typed known fields. */
function normalize(raw: unknown): Preferences {
  const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const n = (typeof o['notifications'] === 'object' && o['notifications'] !== null ? o['notifications'] : {}) as Record<
    string,
    unknown
  >
  const d = DEFAULT_PREFERENCES
  return {
    language: o['language'] === 'fr' ? 'fr' : 'en',
    notifications: {
      enabled: bool(n['enabled'], d.notifications.enabled),
      warnings: bool(n['warnings'], d.notifications.warnings),
      recoveries: bool(n['recoveries'], d.notifications.recoveries)
    },
    keepInTray: bool(o['keepInTray'], d.keepInTray)
  }
}

export class SettingsStore {
  private current: Preferences
  private readonly listeners = new Set<Listener>()

  constructor(private readonly file: string) {
    this.current = this.read()
  }

  get(): Preferences {
    return structuredClone(this.current)
  }

  /** Merges the patch with the saved preferences: changing one setting never resets the others. */
  update(patch: PreferencesPatch): Preferences {
    this.current = normalize({
      ...this.current,
      ...patch,
      notifications: { ...this.current.notifications, ...patch.notifications }
    })
    this.save()
    const snapshot = this.get()
    this.listeners.forEach((cb) => cb(snapshot))
    return snapshot
  }

  onChange(cb: Listener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async getLanguage(): Promise<Language> {
    return this.current.language
  }

  async setLanguage(language: Language): Promise<void> {
    this.update({ language })
  }

  private read(): Preferences {
    try {
      return normalize(existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : {})
    } catch {
      return normalize({})
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.current, null, 2))
    renameSync(tmp, this.file)
  }
}
