import {
  DEFAULT_LANGUAGE,
  MAX_RECENT_FILES,
  MAX_RECENT_FILES_MAX,
  MAX_RECENT_FILES_MIN,
  normalizePreviewWidth,
  normalizeSplitRatio,
  PREVIEW_WIDTH_DEFAULT,
  SPLIT_RATIO_DEFAULT,
  SUPPORTED_LANGUAGES,
  type Language,
  type Settings
} from '../types/app'

const SETTINGS_KEY = 'readmeweb_settings'

function detectBrowserLanguage(): Language {
  const browserLang = navigator.language?.toLowerCase() || 'en'
  const matched = SUPPORTED_LANGUAGES.find((lang) => {
    const l = lang.toLowerCase()
    return l === browserLang || browserLang.startsWith(l.split('-')[0])
  })
  return matched ?? DEFAULT_LANGUAGE
}

function getDefaultSettings(): Settings {
  return {
    theme: 'dark',
    previewTheme: 'light',
    language: detectBrowserLanguage(),
    previewFontFamily: 'Inter',
    previewFontSize: 16,
    editorFontSize: 14,
    previewLineHeight: 1.6,
    previewFluidWidth: false,
    splitView: true,
    splitRatio: SPLIT_RATIO_DEFAULT,
    previewWidth: PREVIEW_WIDTH_DEFAULT,
    autoSave: true,
    maxRecentFiles: MAX_RECENT_FILES,
    recentFiles: []
  }
}

export const storageService = {
  getSettings(): Settings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (!stored) return getDefaultSettings()
      const parsed = JSON.parse(stored) as Partial<Settings>
      const base = getDefaultSettings()

      const maxRecent = typeof parsed.maxRecentFiles === 'number'
        ? Math.max(MAX_RECENT_FILES_MIN, Math.min(MAX_RECENT_FILES_MAX, parsed.maxRecentFiles))
        : base.maxRecentFiles

      return {
        theme: parsed.theme === 'light' ? 'light' : 'dark',
        previewTheme: parsed.previewTheme === 'dark' ? 'dark' : 'light',
        language: SUPPORTED_LANGUAGES.includes(parsed.language as Language) ? (parsed.language as Language) : base.language,
        previewFontFamily: typeof parsed.previewFontFamily === 'string' ? parsed.previewFontFamily : base.previewFontFamily,
        previewFontSize: typeof parsed.previewFontSize === 'number' ? parsed.previewFontSize : base.previewFontSize,
        editorFontSize: typeof parsed.editorFontSize === 'number' ? parsed.editorFontSize : base.editorFontSize,
        previewLineHeight: typeof parsed.previewLineHeight === 'number' ? parsed.previewLineHeight : base.previewLineHeight,
        previewFluidWidth: Boolean(parsed.previewFluidWidth),
        splitView: parsed.splitView !== undefined ? Boolean(parsed.splitView) : base.splitView,
        splitRatio: normalizeSplitRatio(parsed.splitRatio, base.splitRatio),
        previewWidth: normalizePreviewWidth(parsed.previewWidth, base.previewWidth),
        autoSave: parsed.autoSave !== undefined ? Boolean(parsed.autoSave) : base.autoSave,
        maxRecentFiles: maxRecent,
        recentFiles: Array.isArray(parsed.recentFiles)
          ? parsed.recentFiles.filter((p): p is string => typeof p === 'string').slice(0, maxRecent)
          : []
      }
    } catch {
      return getDefaultSettings()
    }
  },

  setSettings(patch: Partial<Settings>): Settings {
    const current = this.getSettings()
    const next: Settings = { ...current, ...patch }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    } catch (err) {
      console.warn('Failed to persist settings in localStorage', err)
    }
    return next
  },

  addRecentFile(name: string): string[] {
    const settings = this.getSettings()
    const updated = [name, ...settings.recentFiles.filter((f) => f !== name)].slice(0, settings.maxRecentFiles)
    this.setSettings({ recentFiles: updated })
    return updated
  },

  removeRecentFile(name: string): string[] {
    const settings = this.getSettings()
    const updated = settings.recentFiles.filter((f) => f !== name)
    this.setSettings({ recentFiles: updated })
    return updated
  }
}
