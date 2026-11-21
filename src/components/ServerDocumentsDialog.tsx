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
        className="diagram-modal"
        style={{ width: '820px', maxWidth: '95vw', height: '620px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
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
          <form
            onSubmit={handleAddFolder}
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bg-surface, #27272a)',
              borderBottom: '1px solid var(--border-color, #3f3f46)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary, #f4f4f5)' }}>
              {t('server.addRootFolder', 'Add Root Folder on Server')}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="topbar__search"
                style={{ flex: 1 }}
                type="text"
                placeholder={t('server.folderNamePlaceholder', 'Folder Label (e.g. Project Docs)')}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                required
              />
              <input
                className="topbar__search"
                style={{ flex: 2 }}
                type="text"
                placeholder={t('server.folderPathPlaceholder', 'Absolute Path on Server (e.g. E:/Projects/Docs)')}
                value={newFolderPath}
                onChange={(e) => setNewFolderPath(e.target.value)}
                required
              />
              <button className="btn" type="submit" disabled={addingFolder}>
                {addingFolder ? '...' : t('common.add', 'Add Folder')}
              </button>
            </div>
          </form>
        )}

        {/* Filter & Root Tabs */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-color, #3f3f46)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}
        >
          <input
            className="topbar__search"
            style={{ minWidth: '220px', flex: 1 }}
            type="search"
            placeholder={t('server.searchPlaceholder', 'Filter markdown files...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="segment" role="tablist">
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
                <div key={f.id} style={{ display: 'flex', alignItems: 'center' }}>
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
                      className="iconbtn"
                      style={{ padding: '2px', opacity: 0.6 }}
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
          <div style={{ padding: '8px 16px', color: '#f87171', fontSize: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            {error}
          </div>
        )}

        {/* Document List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('common.loading', 'Loading documents from server...')}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '15px', marginBottom: '8px' }}>
                {t('server.noDocumentsFound', 'No markdown files found')}
              </div>
              <div style={{ fontSize: '13px' }}>
                {searchQuery
                  ? t('server.noMatch', 'No files match your search query.')
                  : t('server.noFilesTip', 'Configure a root folder containing .md files using the button above.')}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
              {filteredDocs.map((doc) => (
                <div
                  key={`${doc.rootId}-${doc.relativePath}`}
                  onClick={() => onSelectDocument(doc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    border: '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface, #27272a)'
                    e.currentTarget.style.borderColor = 'var(--border-color, #3f3f46)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <span style={{ color: 'var(--accent-color, #38bdf8)' }}>
                      📄
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: '14px',
                          color: 'var(--text-primary, #f4f4f5)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {doc.name}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted, #a1a1aa)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        <span style={{ color: 'var(--accent-color, #38bdf8)', opacity: 0.8 }}>
                          [{doc.rootName}]
                        </span>{' '}
                        {doc.relativePath}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0, fontSize: '12px', color: 'var(--text-muted, #a1a1aa)' }}>
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
