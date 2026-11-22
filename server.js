/**
 * ReadmeWeb - Standalone Production Node.js Server
 * 
 * Zero-dependency server for hosting ReadmeWeb on VPS, Docker, or Node.js environments.
 * Serves static build files from dist/ and handles all Server Documents API endpoints.
 * 
 * Usage:
 *   node server.js [port]
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = parseInt(process.env.PORT || process.argv[2] || '3000', 10)
const DIST_DIR = fs.existsSync(path.resolve(__dirname, 'dist')) ? path.resolve(__dirname, 'dist') : __dirname
const CONFIG_FILE = fs.existsSync(path.resolve(__dirname, 'readmeweb.config.json'))
  ? path.resolve(__dirname, 'readmeweb.config.json')
  : path.resolve(__dirname, '..', 'readmeweb.config.json')

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
}

function deduplicateFolders(folders) {
  const seenPaths = new Set()
  const unique = []
  for (const f of folders) {
    if (!f.path) continue
    const resolved = path.resolve(f.path).replace(/\\/g, '/').toLowerCase()
    let isDuplicateOrSub = seenPaths.has(resolved)
    if (!isDuplicateOrSub) {
      for (const seen of seenPaths) {
        if (resolved.startsWith(seen + '/')) {
          isDuplicateOrSub = true
          break
        }
      }
    }
    if (!isDuplicateOrSub) {
      seenPaths.add(resolved)
      unique.push(f)
    }
  }
  return unique
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      const data = JSON.parse(raw)
      if (Array.isArray(data.serverFolders) && data.serverFolders.length > 0) {
        return { serverFolders: deduplicateFolders(data.serverFolders) }
      }
    }
  } catch (err) {
    console.error('Failed to read config file:', err)
  }
  return {
    serverFolders: [
      {
        id: 'folder-docs',
        name: 'All docs of server',
        path: 'docs'
      }
    ]
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Failed to save config file:', err)
    return false
  }
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  })
  res.end(JSON.stringify(data))
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 50 * 1024 * 1024) {
        req.destroy()
        reject(new Error('Request body too large'))
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function scanMarkdownFiles(dir, baseDir, rootId, rootName, results, maxDepth = 15, currentDepth = 0) {
  if (currentDepth > maxDepth) return
  const IGNORED = new Set([
    'node_modules', '.git', 'dist', '.tmp', 'out', 'release',
    '.system_generated', 'target', 'build', 'vendor', '.cache'
  ])

  let entries = []
  try {
    if (!fs.existsSync(dir)) return
    entries = fs.readdirSync(dir)
  } catch {
    return
  }

  const normalizedBase = path.resolve(baseDir).replace(/\\/g, '/')

  for (const entryName of entries) {
    if (entryName.startsWith('.') && entryName !== '.github') continue
    if (IGNORED.has(entryName)) continue

    const fullPath = path.join(dir, entryName)

    try {
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        scanMarkdownFiles(fullPath, baseDir, rootId, rootName, results, maxDepth, currentDepth + 1)
      } else if (stat.isFile()) {
        const lower = entryName.toLowerCase()
        if (
          lower.endsWith('.md') ||
          lower.endsWith('.markdown') ||
          lower.endsWith('.mdown') ||
          lower.endsWith('.mkd') ||
          lower.endsWith('.mdx')
        ) {
          const rel = path.relative(normalizedBase, path.resolve(fullPath)).replace(/\\/g, '/')
          results.push({
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
      // Skip individually unreadable file or broken symlink
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    })
    return res.end()
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const pathname = parsedUrl.pathname

  // -------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    const route = pathname.replace(/^\/api\/?/, '')

    // 1. GET /api/server-folders
    if (route === 'server-folders' && req.method === 'GET') {
      const config = loadConfig()
      return jsonResponse(res, 200, { ok: true, folders: config.serverFolders })
    }

    // 2. POST /api/server-folders
    if (route === 'server-folders' && req.method === 'POST') {
      const body = await parseJsonBody(req)
      const name = String(body.name || '').trim()
      let folderPath = String(body.path || '').trim().replace(/[/\\]+$/, '')

      if (!name || !folderPath) {
        return jsonResponse(res, 400, { ok: false, error: 'Folder label and absolute path are required' })
      }

      if (!fs.existsSync(folderPath)) {
        try {
          fs.mkdirSync(folderPath, { recursive: true })
        } catch {
          // Might not have permission to mkdir in root/mount, check below
        }
      }

      if (!fs.existsSync(folderPath)) {
        return jsonResponse(res, 400, { ok: false, error: `Directory does not exist on server: ${folderPath}` })
      }

      try {
        const stat = fs.statSync(folderPath)
        if (!stat.isDirectory()) {
          return jsonResponse(res, 400, { ok: false, error: 'Path is not a valid directory' })
        }
      } catch (err) {
        return jsonResponse(res, 400, { ok: false, error: `Directory invalid: ${err.message}` })
      }

      const config = loadConfig()

      // Prevent duplicate folder label or duplicate resolved path
      const duplicateName = config.serverFolders.find(
        (f) => f.name.trim().toLowerCase() === name.toLowerCase()
      )
      if (duplicateName) {
        return jsonResponse(res, 400, { ok: false, error: `A folder with label "${name}" already exists` })
      }

      const resolvedNew = path.resolve(folderPath).replace(/\\/g, '/').toLowerCase()
      const duplicatePath = config.serverFolders.find((f) => {
        const existingResolved = path.resolve(f.path).replace(/\\/g, '/').toLowerCase()
        return existingResolved === resolvedNew
      })
      if (duplicatePath) {
        return jsonResponse(res, 400, {
          ok: false,
          error: `This folder path is already configured as "${duplicatePath.name}"`
        })
      }

      // Check if folder is subfolder of existing root folder
      const subfolder = config.serverFolders.find((f) => {
        const existingResolved = path.resolve(f.path).replace(/\\/g, '/').toLowerCase()
        return resolvedNew.startsWith(existingResolved + '/')
      })
      if (subfolder) {
        return jsonResponse(res, 400, {
          ok: false,
          error: `This folder is a subfolder of "${subfolder.name}", which is already configured.`
        })
      }

      // Check if folder is parent of existing root folder
      const parentFolder = config.serverFolders.find((f) => {
        const existingResolved = path.resolve(f.path).replace(/\\/g, '/').toLowerCase()
        return existingResolved.startsWith(resolvedNew + '/')
      })
      if (parentFolder) {
        return jsonResponse(res, 400, {
          ok: false,
          error: `This folder contains "${parentFolder.name}", which is already configured as a root folder.`
        })
      }

      const newFolder = {
        id: `folder-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
        name,
        path: folderPath
      }
      config.serverFolders.push(newFolder)
      saveConfig(config)

      return jsonResponse(res, 200, { ok: true, folder: newFolder, folders: config.serverFolders })
    }

    // 3. DELETE /api/server-folders
    if (route === 'server-folders' && req.method === 'DELETE') {
      const body = await parseJsonBody(req)
      const id = String(body.id || parsedUrl.searchParams.get('id') || '').trim()
      if (!id) {
        return jsonResponse(res, 400, { ok: false, error: 'Folder id is required' })
      }
      const config = loadConfig()
      config.serverFolders = config.serverFolders.filter(f => f.id !== id)
      saveConfig(config)
      return jsonResponse(res, 200, { ok: true, folders: config.serverFolders })
    }

    // 4. GET /api/server-documents
    if (route === 'server-documents' && req.method === 'GET') {
      const config = loadConfig()
      const rootId = parsedUrl.searchParams.get('rootId')
      const targetFolders = rootId ? config.serverFolders.filter(f => f.id === rootId) : config.serverFolders
      const documents = []

      for (const folder of targetFolders) {
        const cleanPath = String(folder.path || '').trim().replace(/[/\\]+$/, '')
        if (cleanPath && fs.existsSync(cleanPath)) {
          scanMarkdownFiles(cleanPath, cleanPath, folder.id, folder.name, documents)
        }
      }

      return jsonResponse(res, 200, { ok: true, documents, folders: config.serverFolders })
    }

    // 5. GET /api/read-server-document
    if (route === 'read-server-document' && req.method === 'GET') {
      const rootId = parsedUrl.searchParams.get('rootId')
      const relPath = parsedUrl.searchParams.get('path')

      if (!rootId || !relPath) {
        return jsonResponse(res, 400, { ok: false, error: 'rootId and path are required' })
      }

      const config = loadConfig()
      const folder = config.serverFolders.find(f => f.id === rootId)
      if (!folder || !fs.existsSync(folder.path)) {
        return jsonResponse(res, 404, { ok: false, error: 'Configured folder not found' })
      }

      const rootBase = path.resolve(folder.path)
      const targetPath = path.resolve(rootBase, relPath)

      // Traversal guard
      if (!targetPath.startsWith(rootBase) || !fs.existsSync(targetPath)) {
        return jsonResponse(res, 404, { ok: false, error: 'Document not found or access denied' })
      }

      try {
        const content = fs.readFileSync(targetPath, 'utf-8')
        const stat = fs.statSync(targetPath)
        return jsonResponse(res, 200, {
          ok: true,
          content,
          name: path.basename(targetPath),
          path: relPath,
          rootId,
          rootName: folder.name,
          sizeBytes: stat.size,
          lastModified: stat.mtimeMs
        })
      } catch (err) {
        return jsonResponse(res, 500, { ok: false, error: `Could not read document: ${err.message}` })
      }
    }

    // 6. POST /api/save-server-document
    if (route === 'save-server-document' && req.method === 'POST') {
      const body = await parseJsonBody(req)
      const { rootId, path: relPath, content } = body

      if (!rootId || !relPath || typeof content !== 'string') {
        return jsonResponse(res, 400, { ok: false, error: 'rootId, path, and content string are required' })
      }

      const config = loadConfig()
      const folder = config.serverFolders.find(f => f.id === rootId)
      if (!folder || !fs.existsSync(folder.path)) {
        return jsonResponse(res, 404, { ok: false, error: 'Configured folder not found' })
      }

      const rootBase = path.resolve(folder.path)
      const targetPath = path.resolve(rootBase, relPath)

      if (!targetPath.startsWith(rootBase)) {
        return jsonResponse(res, 403, { ok: false, error: 'Access denied: Path escapes root directory' })
      }

      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true })
        fs.writeFileSync(targetPath, content, 'utf-8')
        const stat = fs.statSync(targetPath)
        return jsonResponse(res, 200, {
          ok: true,
          sizeBytes: stat.size,
          lastModified: stat.mtimeMs
        })
      } catch (err) {
        return jsonResponse(res, 500, { ok: false, error: `Failed to save file: ${err.message}` })
      }
    }

    return jsonResponse(res, 404, { ok: false, error: `API route not found: ${route}` })
  }

  // -------------------------------------------------------------
  // Static File Serving
  // -------------------------------------------------------------
  let sanitizedPath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  let filePath = path.join(DIST_DIR, sanitizedPath)

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    return res.end('ReadmeWeb production build not found. Please run `npm run build` first.')
  }

  const ext = path.extname(filePath).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

  res.writeHead(200, { 'Content-Type': mimeType })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(`ReadmeWeb running at http://localhost:${PORT}`)
})
