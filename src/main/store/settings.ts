import { existsSync, readFileSync, writeFileSync } from 'node:fs'

type Language = 'en' | 'fr'

export class SettingsStore {
  constructor(private readonly file: string) {}

  async getLanguage(): Promise<Language> {
    try {
      if (!existsSync(this.file)) return 'en'
      const data = JSON.parse(readFileSync(this.file, 'utf8')) as { language?: string }
      return data.language === 'fr' ? 'fr' : 'en'
    } catch {
      return 'en'
    }
  }

  async setLanguage(language: Language): Promise<void> {
    writeFileSync(this.file, JSON.stringify({ language }))
  }
}
