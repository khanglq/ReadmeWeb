export type Theme = 'light' | 'dark'

export const SUPPORTED_LANGUAGES = [
  'en', 'en-GB', 'pt-BR', 'pt-PT', 'es', 'fr', 'de', 'it', 'nl', 'ar', 'hi', 'ja', 'zh', 'zh-TW', 'ru', 'vi'
] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]
export const DEFAULT_LANGUAGE: Language = 'en'

export const MARKDOWN_EXTENSIONS = ['.md', '.markdown'] as const

export const MAX_RECENT_FILES = 10
export const MAX_RECENT_FILES_MIN = 1
export const MAX_RECENT_FILES_MAX = 50

export const PREVIEW_WIDTH_MIN = 20
export const PREVIEW_WIDTH_MAX = 100
export const PREVIEW_WIDTH_STEP = 5
export const PREVIEW_WIDTH_DEFAULT = 60

export const SPLIT_RATIO_MIN = 20
export const SPLIT_RATIO_MAX = 80
export const SPLIT_RATIO_DEFAULT = 50
export const SPLIT_MIN_WIDTH_PX = 700

export const AUTO_SAVE_DELAY_MS = 750

export function normalizePreviewWidth(value: unknown, fallback = PREVIEW_WIDTH_DEFAULT): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const bounded = Math.min(PREVIEW_WIDTH_MAX, Math.max(PREVIEW_WIDTH_MIN, value))
  return Math.round(bounded / PREVIEW_WIDTH_STEP) * PREVIEW_WIDTH_STEP
}

export function normalizeSplitRatio(value: unknown, fallback = SPLIT_RATIO_DEFAULT): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.round(Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, value)))
}

export interface RecentFileItem {
  id: string
  name: string
  sizeBytes: number
  lastOpened: number
}

export interface Settings {
  theme: Theme
  previewTheme: Theme
  language: Language
  previewFontFamily: string
  previewFontSize: number
  editorFontSize: number
  previewLineHeight: number
  previewFluidWidth: boolean
  splitView: boolean
  splitRatio: number
  previewWidth: number
  autoSave: boolean
  maxRecentFiles: number
  recentFiles: string[]
}

export type DocumentSizeProfile = 'normal' | 'large' | 'very-large'

export function computeSizeProfile(bytes: number): DocumentSizeProfile {
  if (bytes > 20 * 1024 * 1024) return 'very-large'
  if (bytes > 5 * 1024 * 1024) return 'large'
  return 'normal'
}

export interface DraftEditPayload {
  from: number
  to: number
  insert: string
}

export type DraftPersistReason = 'memory-budget' | 'disk-space'

export interface DraftPersistProblem {
  reason: DraftPersistReason
  requiredBytes: number
  availableBytes: number
}

export interface PerformanceMetric {
  name: string
  durationMs: number
  timestamp: number
  details: Record<string, number>
}

export interface PerformanceReport {
  metrics: PerformanceMetric[]
}

export type ExportFormat = 'pdf' | 'html' | 'png'

export type ExportPhase = 'render' | 'fonts' | 'capture' | 'compress' | 'write'

export interface ExportProgress {
  phase: ExportPhase
  slice?: number
  slices?: number
}

export type ExportPageSize = 'A4' | 'Letter' | 'Legal'

export type ExportPageOrientation = 'portrait' | 'landscape'

export const EXPORT_PAGE_SIZES: Array<{ value: ExportPageSize; label: string; width: number; height: number }> = [
  { value: 'A4', label: 'A4 (210 x 297 mm)', width: 794, height: 1123 },
  { value: 'Letter', label: 'Letter (8.5 x 11 in)', width: 816, height: 1056 },
  { value: 'Legal', label: 'Legal (8.5 x 14 in)', width: 816, height: 1344 }
]

export interface ExportRequest {
  format: ExportFormat
  html: string
  pageSize?: ExportPageSize
  orientation?: ExportPageOrientation
  suggestedName?: string
}

export interface DiagramPngRequest {
  dataUrl: string
  baseName?: string
}

export type UpdateStatus = 'unsupported' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'error'

export interface UpdateState {
  status: UpdateStatus
  currentVersion: string
  version?: string
  error?: string
}

