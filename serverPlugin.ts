import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

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

const CONFIG_PATH = resolve(__dirname, 'readmeweb.config.json')

function loadConfig(): { serverFolders: ServerFolder[] } {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
      if (Array.isArray(data.serverFolders) && data.serverFolders.length > 0) return data
    }
  } catch (err) {
    console.error('[serverDocumentsPlugin] Failed to read config:', err)
  }
  return {
    serverFolders: [
      {
        id: 'chessvn-docs',
        name: 'All Chessvn docs',
        path: '/mnt/lqk_hdd/MyData/Work/Projects/Chessvn'
      },
      {
        id: 'chessvn-coding-docs',
        name: 'All Chessvn Coding docs',
        path: '/mnt/lqk_hdd/MyData/Work/Projects/Chessvn'
      }
    ]
  }
}

function saveConfig(config: { serverFolders: ServerFolder[] }): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8')
  } catch (err) {
    console.error('[serverDocumentsPlugin] Failed to write config:', err)
  }
}

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.tmp', 'out', 'release',
  '.system_generated', 'target', 'build', 'vendor', '.cache'
])

function scanMarkdownFiles(dir: string, baseDir: string, rootId: string, rootName: string, items: ServerDocItem[] = [], maxDepth = 15, currentDepth = 0): ServerDocItem[] {
  if (currentDepth > maxDepth || !existsSync(dir)) return items

  let entries: string[] = []
  try {
    entries = readdirSync(dir)
  } catch {
    return items
  }

  const normalizedBase = resolve(baseDir).replace(/\\/g, '/')

  for (const entryName of entries) {
    if (entryName.startsWith('.') && entryName !== '.github') continue
    if (IGNORED_DIRS.has(entryName)) continue

    const fullPath = join(dir, entryName)

    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        scanMarkdownFiles(fullPath, baseDir, rootId, rootName, items, maxDepth, currentDepth + 1)
      } else if (stat.isFile()) {
        const lower = entryName.toLowerCase()
        if (
          lower.endsWith('.md') ||
          lower.endsWith('.markdown') ||
          lower.endsWith('.mdown') ||
          lower.endsWith('.mkd') ||
          lower.endsWith('.mdx')
        ) {
          const rel = relative(normalizedBase, resolve(fullPath)).replace(/\\/g, '/')
          items.push({
            rootId,
            rootName,
            relativePath: rel,
            name: entryName,
            sizeBytes: stat.size,
            lastModified: stat.mtimeMs
          })
        }
      }
    } catch {
      // Ignore unreadable files or broken symlinks
    }
  }

  return items
}

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

export function serverDocumentsPlugin(): Plugin {
  return {
    name: 'server-documents-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`)
        const pathname = url.pathname

        // 1. GET /api/server-folders
        if (pathname === '/api/server-folders' && req.method === 'GET') {
          const config = loadConfig()
          return sendJson(res, { ok: true, folders: config.serverFolders })
        }

        // 2. POST /api/server-folders (Add root folder)
        if (pathname === '/api/server-folders' && req.method === 'POST') {
          try {
            const body = await parseJsonBody<{ name?: string; path?: string }>(req)
            const name = body.name?.trim()
            let folderPath = body.path?.trim()

            if (!name || !folderPath) {
              return sendJson(res, { ok: false, error: 'Name and Path are required' }, 400)
            }

            folderPath = resolve(folderPath).replace(/\\/g, '/')
            if (!existsSync(folderPath)) {
              return sendJson(res, { ok: false, error: `Directory does not exist on server: ${folderPath}` }, 400)
            }

            const config = loadConfig()
            const id = `folder-${Date.now()}`
            config.serverFolders.push({ id, name, path: folderPath })
            saveConfig(config)

            return sendJson(res, { ok: true, folder: { id, name, path: folderPath }, folders: config.serverFolders })
          } catch (err) {
            return sendJson(res, { ok: false, error: err instanceof Error ? err.message : 'Invalid request' }, 500)
          }
        }

        // 3. DELETE /api/server-folders (Remove root folder)
        if (pathname === '/api/server-folders' && req.method === 'DELETE') {
          try {
            const body = await parseJsonBody<{ id?: string }>(req)
            if (!body.id) return sendJson(res, { ok: false, error: 'Folder id is required' }, 400)

            const config = loadConfig()
            config.serverFolders = config.serverFolders.filter((f) => f.id !== body.id)
            saveConfig(config)

            return sendJson(res, { ok: true, folders: config.serverFolders })
          } catch (err) {
            return sendJson(res, { ok: false, error: err instanceof Error ? err.message : 'Invalid request' }, 500)
          }
        }

        // 4. GET /api/server-documents (Scan all or specific folder)
        if (pathname === '/api/server-documents' && req.method === 'GET') {
          const config = loadConfig()
          const rootId = url.searchParams.get('rootId')
          const folders = rootId
            ? config.serverFolders.filter((f) => f.id === rootId)
            : config.serverFolders

          const documents: ServerDocItem[] = []
          for (const folder of folders) {
            const cleanPath = (folder.path || '').trim().replace(/[/\\]+$/, '')
            if (cleanPath && existsSync(cleanPath)) {
              scanMarkdownFiles(cleanPath, cleanPath, folder.id, folder.name, documents)
            }
          }

          return sendJson(res, { ok: true, documents, folders: config.serverFolders })
        }

        // 5. GET /api/read-server-document?rootId=...&path=...
        if (pathname === '/api/read-server-document' && req.method === 'GET') {
          const rootId = url.searchParams.get('rootId')
          const relativePath = url.searchParams.get('path')

          if (!rootId || !relativePath) {
            return sendJson(res, { ok: false, error: 'rootId and path are required' }, 400)
          }

          const config = loadConfig()
          const folder = config.serverFolders.find((f) => f.id === rootId)
          if (!folder) {
            return sendJson(res, { ok: false, error: 'Configured folder not found' }, 404)
          }

          const safeBasePath = resolve(folder.path)
          const targetFullPath = resolve(safeBasePath, relativePath)

          // Security check: ensure path does not escape root
          if (!targetFullPath.startsWith(safeBasePath)) {
            return sendJson(res, { ok: false, error: 'Access denied: Path escapes root directory' }, 403)
          }

          if (!existsSync(targetFullPath)) {
            return sendJson(res, { ok: false, error: 'File not found on server' }, 404)
          }

          try {
            const content = readFileSync(targetFullPath, 'utf8')
            const stat = statSync(targetFullPath)
            const fileName = relativePath.split(/[/\\]/).pop() || relativePath
            return sendJson(res, {
              ok: true,
              content,
              name: fileName,
              path: relativePath,
              rootId,
              rootName: folder.name,
              sizeBytes: stat.size,
              lastModified: stat.mtimeMs
            })
          } catch (err) {
            return sendJson(res, { ok: false, error: err instanceof Error ? err.message : 'Read error' }, 500)
          }
        }

        // 6. POST /api/save-server-document
        if (pathname === '/api/save-server-document' && req.method === 'POST') {
          try {
            const body = await parseJsonBody<{ rootId?: string; path?: string; content?: string }>(req)
            const { rootId, path: relativePath, content } = body

            if (!rootId || !relativePath || typeof content !== 'string') {
              return sendJson(res, { ok: false, error: 'rootId, path, and content are required' }, 400)
            }

            const config = loadConfig()
            const folder = config.serverFolders.find((f) => f.id === rootId)
            if (!folder) {
              return sendJson(res, { ok: false, error: 'Configured folder not found' }, 404)
            }

            const safeBasePath = resolve(folder.path)
            const targetFullPath = resolve(safeBasePath, relativePath)

            if (!targetFullPath.startsWith(safeBasePath)) {
              return sendJson(res, { ok: false, error: 'Access denied: Path escapes root directory' }, 403)
            }

            writeFileSync(targetFullPath, content, 'utf8')
            const stat = statSync(targetFullPath)

            return sendJson(res, { ok: true, sizeBytes: stat.size, lastModified: stat.mtimeMs })
          } catch (err) {
            return sendJson(res, { ok: false, error: err instanceof Error ? err.message : 'Save error' }, 500)
          }
        }

        next()
      })
    }
  }
}
