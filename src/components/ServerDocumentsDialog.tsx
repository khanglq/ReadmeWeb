import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  IconServer,
  IconFolder,
  IconFolderPlus,
  IconTrash,
  IconX,
  IconChevronRight,
  IconExpandAll,
  IconCollapseAll,
  IconList,
  IconFileText
} from './icons'
import { serverDocService, type ServerDocItem, type ServerFolder } from '../services/serverDocService'

interface ServerDocumentsDialogProps {
  onClose: () => void
  onSelectDocument: (doc: ServerDocItem) => void
}

export interface DocTreeNode {
  id: string
  name: string
  relativePath: string
  isFolder: boolean
  isRootFolder?: boolean
  rootId: string
  rootName: string
  doc?: ServerDocItem
  children: DocTreeNode[]
  totalDocsCount: number
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Builds a nested directory tree from a flat list of server document items
 * belonging to a single root folder.
 */
function buildFolderTree(docs: ServerDocItem[], rootId: string, rootName: string): DocTreeNode[] {
  const folderMap = new Map<string, DocTreeNode>()
  const rootChildren: DocTreeNode[] = []

  function getOrCreateFolder(folderPath: string): DocTreeNode {
    const existing = folderMap.get(folderPath)
    if (existing) return existing

    const parts = folderPath.split('/')
    const folderName = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')

    const folderNode: DocTreeNode = {
      id: `folder:${rootId}:${folderPath}`,
      name: folderName,
      relativePath: folderPath,
      isFolder: true,
      rootId,
      rootName,
      children: [],
      totalDocsCount: 0
    }

    folderMap.set(folderPath, folderNode)

    if (parentPath === '') {
      rootChildren.push(folderNode)
    } else {
      const parentFolder = getOrCreateFolder(parentPath)
      parentFolder.children.push(folderNode)
    }

    return folderNode
  }

  for (const doc of docs) {
    const normalized = doc.relativePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/')
    const parts = normalized.split('/')
    const fileName = parts.pop() || doc.name
    const folderPath = parts.join('/')

    const fileNode: DocTreeNode = {
      id: `doc:${rootId}:${normalized}`,
      name: doc.name || fileName,
      relativePath: normalized,
      isFolder: false,
      rootId,
      rootName,
      doc,
      children: [],
      totalDocsCount: 1
    }

    if (folderPath === '') {
      rootChildren.push(fileNode)
    } else {
      const parentFolder = getOrCreateFolder(folderPath)
      parentFolder.children.push(fileNode)

      // Increment doc count for this folder and all its ancestors
      let cur = folderPath
      while (cur !== '') {
        const f = folderMap.get(cur)
        if (f) f.totalDocsCount += 1
        const slashIdx = cur.lastIndexOf('/')
        cur = slashIdx > -1 ? cur.slice(0, slashIdx) : ''
      }
    }
  }

  function sortNodes(nodes: DocTreeNode[]): DocTreeNode[] {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1
      if (!a.isFolder && b.isFolder) return 1
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    })
    for (const node of nodes) {
      if (node.children.length > 0) {
        sortNodes(node.children)
      }
    }
    return nodes
  }

  return sortNodes(rootChildren)
}

interface ServerDocTreeNodeProps {
  node: DocTreeNode
  depth: number
  collapsedFolderIds: Set<string>
  onToggleFolder: (id: string) => void
  onSelectDocument: (doc: ServerDocItem) => void
  isSearching: boolean
  showRootName: boolean
}

function ServerDocTreeNode({
  node,
  depth,
  collapsedFolderIds,
  onToggleFolder,
  onSelectDocument,
  isSearching,
  showRootName
}: ServerDocTreeNodeProps): JSX.Element {
  const { t } = useTranslation()

  if (node.isFolder) {
    const isCollapsed = isSearching ? false : collapsedFolderIds.has(node.id)

    return (
      <div className="server-dialog__tree-group">
        <div
          className={`server-dialog__tree-folder ${node.isRootFolder ? 'server-dialog__tree-folder--root' : ''}`}
          onClick={() => onToggleFolder(node.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggleFolder(node.id)
            }
          }}
          title={node.name}
        >
          <button
            type="button"
            className={`server-dialog__tree-toggle ${!isCollapsed ? 'server-dialog__tree-toggle--open' : ''}`}
            aria-label={isCollapsed ? t('server.expand', 'Expand') : t('server.collapse', 'Collapse')}
            onClick={(e) => {
              e.stopPropagation()
              onToggleFolder(node.id)
            }}
          >
            <IconChevronRight width={14} height={14} />
          </button>

          <span className="server-dialog__tree-folder-icon">
            <IconFolder width={16} height={16} />
          </span>

          <span className="server-dialog__tree-folder-name">
            {node.name}
          </span>

          <span
            className="server-dialog__tree-badge"
            title={`${node.totalDocsCount} ${t('server.docCount', { count: node.totalDocsCount })}`}
          >
            {node.totalDocsCount}
          </span>
        </div>

        {!isCollapsed && node.children.length > 0 && (
          <div className="server-dialog__tree-children">
            {node.children.map((child) => (
              <ServerDocTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                collapsedFolderIds={collapsedFolderIds}
                onToggleFolder={onToggleFolder}
                onSelectDocument={onSelectDocument}
                isSearching={isSearching}
                showRootName={showRootName}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Document file node
  const doc = node.doc!
  return (
    <div
      className="server-dialog__item server-dialog__tree-file"
      onClick={() => onSelectDocument(doc)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onSelectDocument(doc)
        }
      }}
    >
      <div className="server-dialog__item-main">
        <span className="server-dialog__tree-spacer" aria-hidden="true" />
        <span className="server-dialog__item-icon">
          <IconFileText width={16} height={16} />
        </span>
        <div className="server-dialog__item-text">
          <div className="server-dialog__item-name" title={doc.name}>
            {doc.name}
          </div>
          <div className="server-dialog__item-path" title={doc.relativePath}>
            {showRootName && <span className="server-dialog__item-root">[{doc.rootName}] </span>}
            {doc.relativePath}
          </div>
        </div>
      </div>

      <div className="server-dialog__item-meta">
        <span>{formatBytes(doc.sizeBytes)}</span>
        <span>{formatDate(doc.lastModified)}</span>
      </div>
    </div>
  )
}

export function ServerDocumentsDialog({ onClose, onSelectDocument }: ServerDocumentsDialogProps): JSX.Element {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<ServerDocItem[]>([])
  const [folders, setFolders] = useState<ServerFolder[]>([])
  const [selectedRootId, setSelectedRootId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // View mode: 'tree' (partitioned by folder hierarchy) or 'flat' (flat document list)
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree')
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set())

  // Add folder form
  const [showAddFolder, setShowAddFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [addingFolder, setAddingFolder] = useState(false)

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await serverDocService.getServerDocuments()
    if (res.ok) {
      setDocuments(res.documents)
      setFolders(res.folders)
    } else {
      setError(res.error || 'Failed to load documents from server')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  // Reset collapsed folders when active root folder changes
  useEffect(() => {
    setCollapsedFolderIds(new Set())
  }, [selectedRootId])

  // Automatically expand folders when typing a search query
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      setCollapsedFolderIds(new Set())
    }
  }

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return documents.filter((doc) => {
      const matchesRoot = selectedRootId === 'all' || doc.rootId === selectedRootId
      const matchesQuery =
        q === '' ||
        doc.name.toLowerCase().includes(q) ||
        doc.relativePath.toLowerCase().includes(q)
      return matchesRoot && matchesQuery
    })
  }, [documents, selectedRootId, searchQuery])

  // Build hierarchical folder tree
  const tree = useMemo(() => {
    if (selectedRootId === 'all') {
      if (folders.length <= 1) {
        const single = folders[0]
        return buildFolderTree(filteredDocs, single?.id || 'default', single?.name || 'Server')
      }

      const rootNodes: DocTreeNode[] = []
      const knownIds = new Set(folders.map((f) => f.id))

      for (const folder of folders) {
        const rootDocs = filteredDocs.filter((d) => d.rootId === folder.id)
        if (rootDocs.length === 0 && searchQuery.trim() !== '') {
          continue
        }
        const children = buildFolderTree(rootDocs, folder.id, folder.name)
        rootNodes.push({
          id: `root:${folder.id}`,
          name: folder.name,
          relativePath: '',
          isFolder: true,
          isRootFolder: true,
          rootId: folder.id,
          rootName: folder.name,
          children,
          totalDocsCount: rootDocs.length
        })
      }

      // Safeguard for docs whose rootId is not in configured folders
      const orphanDocs = filteredDocs.filter((d) => !knownIds.has(d.rootId))
      if (orphanDocs.length > 0) {
        const orphanChildren = buildFolderTree(orphanDocs, 'other', 'Other Documents')
        rootNodes.push({
          id: 'root:other',
          name: t('server.otherFolders', 'Other Documents'),
          relativePath: '',
          isFolder: true,
          isRootFolder: true,
          rootId: 'other',
          rootName: 'Other Documents',
          children: orphanChildren,
          totalDocsCount: orphanDocs.length
        })
      }

      return rootNodes
    }

    const currentFolder = folders.find((f) => f.id === selectedRootId)
    const rName = currentFolder?.name || 'Server'
    return buildFolderTree(filteredDocs, selectedRootId, rName)
  }, [selectedRootId, folders, filteredDocs, searchQuery, t])

  const toggleFolder = useCallback((folderId: string) => {
    setCollapsedFolderIds((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) {
        next.delete(folderId)
      } else {
        next.add(folderId)
      }
      return next
    })
  }, [])

  const handleExpandAll = useCallback(() => {
    setCollapsedFolderIds(new Set())
  }, [])

  const handleCollapseAll = useCallback(() => {
    const ids = new Set<string>()
    const collect = (nodes: DocTreeNode[]) => {
      for (const n of nodes) {
        if (n.isFolder) {
          ids.add(n.id)
          if (n.children.length > 0) collect(n.children)
        }
      }
    }
    collect(tree)
    setCollapsedFolderIds(ids)
  }, [tree])

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim() || !newFolderPath.trim()) return

    setAddingFolder(true)
    setError(null)
    const res = await serverDocService.addServerFolder(newFolderName.trim(), newFolderPath.trim())
    if (res.ok && res.folders) {
      setFolders(res.folders)
      setNewFolderName('')
      setNewFolderPath('')
      setShowAddFolder(false)
      void loadDocuments()
    } else {
      setError(res.error || 'Failed to add folder')
    }
    setAddingFolder(false)
  }

  const handleRemoveFolder = async (folderId: string, folderName: string) => {
    if (!confirm(t('server.confirmRemoveFolder', { name: folderName, defaultValue: `Remove "${folderName}" from server folders?` }))) return
    const res = await serverDocService.removeServerFolder(folderId)
    if (res.ok && res.folders) {
      setFolders(res.folders)
      if (selectedRootId === folderId) setSelectedRootId('all')
      void loadDocuments()
    } else {
      setError(res.error || 'Failed to remove folder')
    }
  }

  return (
    <div className="diagram-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="diagram-modal server-dialog"
        role="dialog"
        aria-label={t('server.title', 'Server Documents')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="diagram-modal__header">
          <div className="diagram-modal__title-group">
            <span className="diagram-modal__title-icon">
              <IconServer width={18} height={18} />
            </span>
            <h2 className="diagram-modal__title">{t('server.title', 'Server Documents')}</h2>
          </div>
          <div className="diagram-modal__actions">
            <button
              className="iconbtn"
              type="button"
              onClick={() => setShowAddFolder((s) => !s)}
              title={t('server.configureFolders', 'Configure Server Folders')}
            >
              <IconFolderPlus width={16} height={16} />
            </button>
            <button className="iconbtn" type="button" onClick={onClose} title={t('common.close', 'Close')}>
              <IconX width={16} height={16} />
            </button>
          </div>
        </div>

        {/* Add Folder Panel (collapsible) */}
        {showAddFolder && (
          <form onSubmit={handleAddFolder} className="server-dialog__add-form">
            <div className="server-dialog__add-title">
              {t('server.addRootFolder', 'Add Root Folder on Server')}
            </div>
            <div className="server-dialog__add-fields">
              <input
                className="topbar__search server-dialog__input"
                type="text"
                placeholder={t('server.folderNamePlaceholder', 'Folder Label (e.g. Project Docs)')}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
              />
              <input
                className="topbar__search server-dialog__input server-dialog__input--grow"
                type="text"
                placeholder={t('server.folderPathPlaceholder', 'Absolute Path on Server (e.g. E:/Projects/Docs)')}
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                required
              />
              <button className="btn btn--primary" type="submit" disabled={addingFolder}>
                {addingFolder ? '...' : t('server.addFolderBtn', 'Add Folder')}
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar with Search, View Controls & Root Tabs */}
        <div className="server-dialog__filter-bar">
          <div className="server-dialog__search-row">
            <input
              className="topbar__search server-dialog__search"
              type="search"
              placeholder={t('server.searchPlaceholder', 'Filter markdown files...')}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />

            <div className="server-dialog__view-controls">
              {viewMode === 'tree' && (
                <div className="server-dialog__tree-actions">
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={handleExpandAll}
                    title={t('server.expandAll', 'Expand all folders')}
                  >
                    <IconExpandAll width={15} height={15} />
                  </button>
                  <button
                    type="button"
                    className="iconbtn"
                    onClick={handleCollapseAll}
                    title={t('server.collapseAll', 'Collapse all folders')}
                  >
                    <IconCollapseAll width={15} height={15} />
                  </button>
                </div>
              )}

              <div className="segment server-dialog__view-mode" role="group" aria-label={t('toolbar.viewMode', 'View Mode')}>
                <button
                  className={`segment__btn ${viewMode === 'tree' ? 'segment__btn--active' : ''}`}
                  onClick={() => setViewMode('tree')}
                  type="button"
                  title={t('server.viewTree', 'Folder Tree')}
                >
                  <IconFolder width={14} height={14} />
                  <span className="server-dialog__btn-text">{t('server.tree', 'Tree')}</span>
                </button>
                <button
                  className={`segment__btn ${viewMode === 'flat' ? 'segment__btn--active' : ''}`}
                  onClick={() => setViewMode('flat')}
                  type="button"
                  title={t('server.viewFlat', 'Flat List')}
                >
                  <IconList width={14} height={14} />
                  <span className="server-dialog__btn-text">{t('server.list', 'List')}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="segment server-dialog__tabs" role="tablist">
            <button
              className={`segment__btn ${selectedRootId === 'all' ? 'segment__btn--active' : ''}`}
              onClick={() => setSelectedRootId('all')}
              type="button"
            >
              {t('server.allFolders', 'All Folders')} ({documents.length})
            </button>
            {folders.map((f) => {
              const count = documents.filter((d) => d.rootId === f.id).length
              return (
                <div key={f.id} className="server-dialog__tab-item">
                  <button
                    className={`segment__btn ${selectedRootId === f.id ? 'segment__btn--active' : ''}`}
                    onClick={() => setSelectedRootId(f.id)}
                    type="button"
                    title={f.path}
                  >
                    <IconFolder width={14} height={14} />
                    {f.name} ({count})
                  </button>
                  {folders.length > 1 && (
                    <button
                      type="button"
                      className="iconbtn server-dialog__folder-remove"
                      onClick={() => handleRemoveFolder(f.id, f.name)}
                      title={`Remove ${f.name}`}
                    >
                      <IconTrash width={12} height={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Error notice */}
        {error && (
          <div className="server-dialog__error">
            {error}
          </div>
        )}

        {/* Document List / Tree Body */}
        <div className="server-dialog__body">
          {loading ? (
            <div className="server-dialog__empty">
              {t('server.loading', 'Loading documents from server...')}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="server-dialog__empty">
              <div className="server-dialog__empty-title">
                {t('server.noDocumentsFound', 'No markdown files found')}
              </div>
              <div className="server-dialog__empty-subtitle">
                {searchQuery
                  ? t('server.noMatch', 'No files match your search query.')
                  : t('server.noFilesTip', 'Configure a root folder containing .md files using the button above.')}
              </div>
            </div>
          ) : viewMode === 'tree' ? (
            <div className="server-dialog__tree">
              {tree.map((node) => (
                <ServerDocTreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  collapsedFolderIds={collapsedFolderIds}
                  onToggleFolder={toggleFolder}
                  onSelectDocument={onSelectDocument}
                  isSearching={searchQuery.trim().length > 0}
                  showRootName={selectedRootId === 'all' && folders.length > 1}
                />
              ))}
            </div>
          ) : (
            <div className="server-dialog__list">
              {filteredDocs.map((doc) => (
                <div
                  key={`${doc.rootId}-${doc.relativePath}`}
                  className="server-dialog__item"
                  onClick={() => onSelectDocument(doc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSelectDocument(doc)
                  }}
                >
                  <div className="server-dialog__item-main">
                    <span className="server-dialog__item-icon">
                      <IconFileText width={16} height={16} />
                    </span>
                    <div className="server-dialog__item-text">
                      <div className="server-dialog__item-name" title={doc.name}>
                        {doc.name}
                      </div>
                      <div className="server-dialog__item-path" title={doc.relativePath}>
                        {folders.length > 1 && (
                          <span className="server-dialog__item-root">[{doc.rootName}] </span>
                        )}
                        {doc.relativePath}
                      </div>
                    </div>
                  </div>

                  <div className="server-dialog__item-meta">
                    <span>{formatBytes(doc.sizeBytes)}</span>
                    <span>{formatDate(doc.lastModified)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
