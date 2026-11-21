import { computeSizeProfile, type DocumentSizeProfile } from '../types/app'

export interface OpenedDocument {
  id: string
  path: string
  name: string
  content: string
  sizeBytes: number
  sizeProfile: DocumentSizeProfile
  handle?: FileSystemFileHandle
  readOnly?: boolean
}

export interface WriteResult {
  ok: boolean
  path?: string
  handle?: FileSystemFileHandle
  error?: string
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

interface FilePickerWindow {
  showOpenFilePicker?(options?: unknown): Promise<FileSystemFileHandle[]>
  showSaveFilePicker?(options?: unknown): Promise<FileSystemFileHandle>
}

export const fileService = {
  isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window
  },

  async openFileDialog(): Promise<OpenedDocument[]> {
    const win = window as unknown as FilePickerWindow
    if (this.isFileSystemAccessSupported() && win.showOpenFilePicker) {
      try {
        const handles = await win.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: 'Markdown Files',
              accept: {
                'text/markdown': ['.md', '.markdown'],
                'text/plain': ['.md', '.markdown', '.txt']
              }
            }
          ]
        })

        const docs: OpenedDocument[] = []
        for (const handle of handles) {
          const file = await handle.getFile()
          const content = await file.text()
          docs.push({
            id: generateId(),
            path: handle.name,
            name: handle.name,
            content,
            sizeBytes: file.size,
            sizeProfile: computeSizeProfile(file.size),
            handle
          })
        }
        return docs
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return []
        console.warn('showOpenFilePicker failed, falling back to input', err)
      }
    }

    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = '.md,.markdown,text/markdown'
      input.style.display = 'none'

      input.onchange = async () => {
        const files = Array.from(input.files || [])
        document.body.removeChild(input)
        const docs = await this.readLocalFiles(files)
        resolve(docs)
      }

      input.oncancel = () => {
        document.body.removeChild(input)
        resolve([])
      }

      document.body.appendChild(input)
      input.click()
    })
  },

  async readLocalFiles(files: File[]): Promise<OpenedDocument[]> {
    const docs: OpenedDocument[] = []
    for (const file of files) {
      if (!file.name.match(/\.(md|markdown|txt)$/i)) continue
      const content = await file.text()
      docs.push({
        id: generateId(),
        path: file.name,
        name: file.name,
        content,
        sizeBytes: file.size,
        sizeProfile: computeSizeProfile(file.size)
      })
    }
    return docs
  },

  async save(content: string, handle?: FileSystemFileHandle, suggestedName = 'document.md'): Promise<WriteResult> {
    if (handle) {
      try {
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        return { ok: true, path: handle.name, handle }
      } catch (err) {
        console.warn('Failed to write directly to handle, falling back to saveAs', err)
      }
    }
    return this.saveAs(content, suggestedName)
  },

  async saveAs(content: string, suggestedName = 'document.md'): Promise<WriteResult> {
    const cleanName = suggestedName.endsWith('.md') || suggestedName.endsWith('.markdown')
      ? suggestedName
      : `${suggestedName}.md`

    const win = typeof window !== 'undefined' ? (window as unknown as FilePickerWindow) : null
    if (win && typeof win.showSaveFilePicker === 'function') {
      try {
        const handle = await win.showSaveFilePicker({
          suggestedName: cleanName,
          types: [
            {
              description: 'Markdown File',
              accept: { 'text/markdown': ['.md', '.markdown'] }
            }
          ]
        })
        const writable = await handle.createWritable()
        await writable.write(content)
        await writable.close()
        return { ok: true, path: handle.name, handle }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return { ok: false, error: 'User canceled' }
        }
        console.warn('showSaveFilePicker failed, falling back to blob download', err)
      }
    }

    try {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = cleanName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { ok: true, path: cleanName }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Save failed' }
    }
  },

  async readSample(sampleName: string): Promise<{ ok: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(`/samples/${sampleName}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const content = await response.text()
      return { ok: true, content }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Failed to load sample' }
    }
  }
}
