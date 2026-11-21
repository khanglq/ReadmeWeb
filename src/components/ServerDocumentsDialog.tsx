import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { IconServer, IconFolder, IconFolderPlus, IconTrash, IconX } from './icons'
import { serverDocService, type ServerDocItem, type ServerFolder } from '../services/serverDocService'

interface ServerDocumentsDialogProps {
  onClose: () => void
  onSelectDocument: (doc: ServerDocItem) => void
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

export function ServerDocumentsDialog({ onClose, onSelectDocument }: ServerDocumentsDialogProps): JSX.Element {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<ServerDocItem[]>([])
  const [folders, setFolders] = useState<ServerFolder[]>([])
  const [selectedRootId, setSelectedRootId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

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

  const filteredDocs = useMemo(() => {
    return documents.filter((doc) => {
      const matchesRoot = selectedRootId === 'all' || doc.rootId === selectedRootId
      const matchesQuery =
        searchQuery.trim() === '' ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.relativePath.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesRoot && matchesQuery
    })
  }, [documents, selectedRootId, searchQuery])

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
    if (!confirm(t('server.confirmRemoveFolder', `Remove "${folderName}" from server folders?`))) return
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
        aria-label={t('toolbar.serverDocuments', 'Server Documents')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="diagram-modal__header">
          <div className="diagram-modal__title-group">
            <span className="diagram-modal__title-icon">
              <IconServer width={18} height={18} />
            </span>
            <h2 className="diagram-modal__title">{t('toolbar.serverDocuments', 'Server Documents')}</h2>
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
                {addingFolder ? '...' : t('common.add', 'Add Folder')}
              </button>
            </div>
          </form>
        )}

        {/* Filter & Root Tabs */}
        <div className="server-dialog__filter-bar">
          <input
            className="topbar__search server-dialog__search"
            type="search"
            placeholder={t('server.searchPlaceholder', 'Filter markdown files...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

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

        {/* Document List */}
        <div className="server-dialog__body">
          {loading ? (
            <div className="server-dialog__empty">
              {t('common.loading', 'Loading documents from server...')}
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
          ) : (
            <div className="server-dialog__list">
              {filteredDocs.map((doc) => (
                <div
                  key={`${doc.rootId}-${doc.relativePath}`}
                  className="server-dialog__item"
                  onClick={() => onSelectDocument(doc)}
                >
                  <div className="server-dialog__item-main">
                    <span className="server-dialog__item-icon">📄</span>
                    <div className="server-dialog__item-text">
                      <div className="server-dialog__item-name">
                        {doc.name}
                      </div>
                      <div className="server-dialog__item-path">
                        <span className="server-dialog__item-root">[{doc.rootName}]</span>{' '}
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
