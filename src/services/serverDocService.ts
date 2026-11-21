export interface ServerFolder {
  id: string
  name: string
  path: string
}

export interface ServerDocItem {
  rootId: string
  rootName: string
  relativePath: string
  name: string
  sizeBytes: number
  lastModified: number
}

export interface ServerDocumentsResponse {
  ok: boolean
  documents: ServerDocItem[]
  folders: ServerFolder[]
  error?: string
}

export interface ReadServerDocResponse {
  ok: boolean
  content?: string
  name?: string
  path?: string
  rootId?: string
  rootName?: string
  sizeBytes?: number
  lastModified?: number
  error?: string
}

export const serverDocService = {
  async getServerDocuments(rootId?: string): Promise<ServerDocumentsResponse> {
    try {
      const url = rootId ? `/api/server-documents?rootId=${encodeURIComponent(rootId)}` : '/api/server-documents'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      return {
        ok: false,
        documents: [],
        folders: [],
        error: err instanceof Error ? err.message : 'Failed to fetch server documents'
      }
    }
  },

  async readServerDocument(rootId: string, relativePath: string): Promise<ReadServerDocResponse> {
    try {
      const res = await fetch(
        `/api/read-server-document?rootId=${encodeURIComponent(rootId)}&path=${encodeURIComponent(relativePath)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to read server document'
      }
    }
  },

  async saveServerDocument(
    rootId: string,
    relativePath: string,
    content: string
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch('/api/save-server-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootId, path: relativePath, content })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to save server document'
      }
    }
  },

  async addServerFolder(
    name: string,
    path: string
  ): Promise<{ ok: boolean; folder?: ServerFolder; folders?: ServerFolder[]; error?: string }> {
    try {
      const res = await fetch('/api/server-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path })
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
      return data
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to add folder'
      }
    }
  },

  async removeServerFolder(id: string): Promise<{ ok: boolean; folders?: ServerFolder[]; error?: string }> {
    try {
      const res = await fetch('/api/server-folders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` }
      return data
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to remove folder'
      }
    }
  }
}
