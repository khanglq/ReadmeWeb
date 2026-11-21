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

/**
 * Safely parse JSON responses from server API endpoints.
 * Handles HTML error pages (e.g. 404, SPA redirects, PHP fatal errors) gracefully
 * with clear human-readable messages instead of cryptic JSON.parse syntax errors.
 */
async function safeJson<T>(res: Response, fallbackErrMsg: string): Promise<T> {
  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()

  let data: any = null
  if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      data = JSON.parse(text)
    } catch {
      // Ignore parse failure; handled below
    }
  }

  if (!res.ok) {
    if (data && typeof data.error === 'string') {
      throw new Error(data.error)
    }
    if (res.status === 404) {
      throw new Error('API server not found (HTTP 404). Please ensure api/index.php and .htaccess are deployed on server.')
    }
    if (res.status === 403) {
      throw new Error('Access denied by server (HTTP 403). Check server file/folder permissions.')
    }
    if (res.status === 500) {
      throw new Error(data?.error || 'Server error (HTTP 500). Please check server PHP error logs.')
    }
    throw new Error(`Server returned HTTP ${res.status}: ${fallbackErrMsg}`)
  }

  if (data === null) {
    if (text.includes('<!doctype html>') || text.includes('<html')) {
      throw new Error('Server returned HTML instead of JSON. Ensure .htaccess routes /api to api/index.php.')
    }
    throw new Error(`Invalid response from server: ${text.slice(0, 120).trim() || fallbackErrMsg}`)
  }

  return data as T
}

export const serverDocService = {
  async getServerDocuments(rootId?: string): Promise<ServerDocumentsResponse> {
    try {
      const url = rootId ? `/api/server-documents?rootId=${encodeURIComponent(rootId)}` : '/api/server-documents'
      const res = await fetch(url)
      return await safeJson<ServerDocumentsResponse>(res, 'Failed to fetch server documents')
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
      return await safeJson<ReadServerDocResponse>(res, 'Failed to read server document')
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
      return await safeJson<{ ok: boolean; error?: string }>(res, 'Failed to save server document')
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
      const data = await safeJson<{ ok: boolean; folder?: ServerFolder; folders?: ServerFolder[]; error?: string }>(
        res,
        'Failed to add folder'
      )
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
      const data = await safeJson<{ ok: boolean; folders?: ServerFolder[]; error?: string }>(
        res,
        'Failed to remove folder'
      )
      return data
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to remove folder'
      }
    }
  }
}
