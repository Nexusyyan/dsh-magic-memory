import React, { useEffect, useState } from 'react'
import {
  MEMORY_CATEGORIES,
  PROJECT_MEMORY_CATEGORIES,
  type MemoryCategory,
  type MemoryRecord,
  type MemoryScope,
  type MemoryStatus,
  type UnifiedSearchHit,
} from '../../shared/types.js'
import type { MagicMemoryApi } from '../api.js'
import type { TranslateFn } from '../locales.js'

export interface MemoriesTabProps {
  api: MagicMemoryApi
  projectId: string
  sessionId?: string
  t: TranslateFn
  refreshToken: number
  onMutated: () => void
  onError: (msg: string) => void
  onNotice: (msg: string) => void
}

interface EditorState {
  mode: 'create' | 'edit'
  id?: number
  scope: MemoryScope
  category: MemoryCategory
  importance: number
  pinned: boolean
  content: string
}

function verificationBadgeClass(state: string): string {
  if (state === 'verified') return 'dmm-badge dmm-badge-ok'
  if (state === 'stale') return 'dmm-badge dmm-badge-warn'
  return 'dmm-badge'
}

export function MemoriesTab({
  api,
  projectId,
  sessionId,
  t,
  refreshToken,
  onMutated,
  onError,
  onNotice,
}: MemoriesTabProps): React.ReactElement {
  const [scope, setScope] = useState<'all' | 'project' | 'global'>('all')
  const [status, setStatus] = useState<MemoryStatus>('active')
  const [category, setCategory] = useState<MemoryCategory | 'ALL'>('ALL')
  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<UnifiedSearchHit[] | null>(null)
  const [searchUsedVector, setSearchUsedVector] = useState(false)
  const [searching, setSearching] = useState(false)

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    api
      .listMemories(
        {
          projectId,
          scope,
          status,
          category: category === 'ALL' ? undefined : category,
          limit: 200,
        },
        controller.signal,
      )
      .then(res => {
        if (!controller.signal.aborted) setMemories(res.memories)
      })
      .catch(err => {
        if (!controller.signal.aborted) onError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [api, projectId, scope, status, category, refreshToken, onError])

  useEffect(() => {
    if (!editor) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditor(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor])

  const runSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchHits(null)
      return
    }
    setSearching(true)
    try {
      const res = await api.searchMemories({
        projectId,
        sessionId,
        query: trimmed,
        categories: category === 'ALL' ? undefined : [category],
        limit: 25,
      })
      setSearchHits([...res.hits])
      setSearchUsedVector(res.usedVectorSearch)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSearching(false)
    }
  }

  const openCreateModal = () => {
    setEditor({
      mode: 'create',
      scope: scope === 'global' ? 'global' : 'project',
      category: scope === 'global' ? 'USER_PROFILE' : (category === 'ALL' || category === 'USER_PROFILE' ? 'PROJECT_RULES' : category),
      importance: 65,
      pinned: false,
      content: '',
    })
  }

  const openEditModal = (mem: MemoryRecord) => {
    setEditor({
      mode: 'edit',
      id: mem.id,
      scope: mem.scope,
      category: mem.category,
      importance: mem.importance,
      pinned: mem.pinned,
      content: mem.content,
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editor) return
    const text = editor.content.trim()
    if (!text) return
    setSaving(true)
    try {
      if (editor.mode === 'create') {
        const res = await api.createMemory({
          projectId,
          sessionId,
          scope: editor.scope,
          category: editor.scope === 'global' ? 'USER_PROFILE' : editor.category,
          importance: editor.importance,
          pinned: editor.pinned,
          content: text,
        })
        onNotice(res.action === 'deduplicated' ? `Merged with existing #${res.memory.id}` : `Saved memory #${res.memory.id}`)
      } else if (editor.id !== undefined) {
        await api.updateMemory({
          projectId,
          id: editor.id,
          category: editor.scope === 'global' ? 'USER_PROFILE' : editor.category,
          importance: editor.importance,
          pinned: editor.pinned,
          content: text,
        })
        onNotice(`Updated memory #${editor.id}`)
      }
      setEditor(null)
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const togglePin = async (mem: MemoryRecord) => {
    try {
      await api.updateMemory({ projectId, id: mem.id, pinned: !mem.pinned })
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleArchiveOrRestore = async (mem: MemoryRecord) => {
    try {
      if (mem.status === 'active') {
        await api.archiveMemory({ projectId, id: mem.id })
        onNotice(`Archived #${mem.id}`)
      } else {
        await api.restoreMemory({ projectId, id: mem.id })
        onNotice(`Restored #${mem.id}`)
      }
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <form className="dmm-search-bar" onSubmit={runSearch}>
        <input
          type="search"
          className="dmm-input"
          aria-label={t('memories.search')}
          placeholder={t('memories.searchPlaceholder')}
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            if (e.target.value.trim().length === 0) setSearchHits(null)
          }}
        />
        <button type="submit" className="dmm-btn" disabled={searching}>
          {t('memories.search')}
        </button>
        {searchHits !== null && (
          <button
            type="button"
            className="dmm-btn dmm-btn-ghost"
            onClick={() => {
              setQuery('')
              setSearchHits(null)
            }}
          >
            {t('memories.clear')}
          </button>
        )}
      </form>

      <div className="dmm-row-between">
        <div className="dmm-chips" role="group" aria-label="Scope filter">
          {(['all', 'project', 'global'] as const).map(s => (
            <button
              key={s}
              type="button"
              className="dmm-chip"
              data-active={scope === s}
              onClick={() => setScope(s)}
            >
              {s === 'all' ? t('memories.scopeAll') : s === 'project' ? t('memories.scopeProject') : t('memories.scopeGlobal')}
            </button>
          ))}
          <button
            type="button"
            className="dmm-chip"
            data-active={status === 'active'}
            onClick={() => setStatus('active')}
          >
            {t('memories.statusActive')}
          </button>
          <button
            type="button"
            className="dmm-chip"
            data-active={status === 'archived'}
            onClick={() => setStatus('archived')}
          >
            {t('memories.statusArchived')}
          </button>
        </div>

        <button type="button" className="dmm-btn dmm-btn-primary" onClick={openCreateModal}>
          + {t('memories.add')}
        </button>
      </div>

      <div className="dmm-chips" role="group" aria-label="Category filter">
        <button
          type="button"
          className="dmm-chip"
          data-active={category === 'ALL'}
          onClick={() => setCategory('ALL')}
        >
          {t('memories.allCategories')}
        </button>
        {MEMORY_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            className="dmm-chip"
            data-active={category === cat}
            onClick={() => setCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {searchHits !== null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="dmm-row-between">
            <span className="dmm-section-title">
              {t('memories.searchResults', { count: searchHits.length })}
            </span>
            <span className="dmm-badge">
              {searchUsedVector ? t('memories.vectorActive') : t('memories.ftsOnly')}
            </span>
          </div>
          {searchHits.length === 0 ? (
            <div className="dmm-empty">{t('memories.empty')}</div>
          ) : (
            searchHits.map(hit => (
              <div key={`${hit.source}-${hit.id}`} className="dmm-card">
                <div className="dmm-row-between">
                  <div className="dmm-row">
                    <span className="dmm-badge dmm-badge-accent">{hit.source.toUpperCase()}</span>
                    {hit.category && <span className="dmm-badge">{hit.category}</span>}
                    {hit.workspaceLabel && <span className="dmm-badge">WS:{hit.workspaceLabel}</span>}
                  </div>
                  <span className="dmm-badge">score {hit.score.toFixed(2)}</span>
                </div>
                <div className="dmm-card-content">{hit.content}</div>
              </div>
            ))
          )}
        </div>
      ) : loading && memories.length === 0 ? (
        <div className="dmm-empty">{t('header.loading')}</div>
      ) : memories.length === 0 ? (
        <div className="dmm-empty">{t('memories.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {memories.map(mem => (
            <article key={mem.id} className="dmm-card" data-memory-id={mem.id}>
              <div className="dmm-row-between">
                <div className="dmm-row">
                  <span className="dmm-badge">#{mem.id}</span>
                  <span className="dmm-badge dmm-badge-accent">{mem.category}</span>
                  {mem.pinned && <span className="dmm-badge dmm-badge-ok">{t('memories.pinnedBadge')}</span>}
                  <span className={verificationBadgeClass(mem.verificationState)}>{mem.verificationState}</span>
                </div>
                <div className="dmm-row">
                  <button type="button" className="dmm-btn dmm-btn-ghost" onClick={() => openEditModal(mem)}>
                    {t('memories.edit')}
                  </button>
                  <button type="button" className="dmm-btn dmm-btn-ghost" onClick={() => void togglePin(mem)}>
                    {mem.pinned ? t('memories.unpin') : t('memories.pin')}
                  </button>
                  <button
                    type="button"
                    className={`dmm-btn dmm-btn-ghost ${mem.status === 'active' ? 'dmm-btn-danger' : ''}`}
                    onClick={() => void handleArchiveOrRestore(mem)}
                  >
                    {mem.status === 'active' ? t('memories.archive') : t('memories.restore')}
                  </button>
                </div>
              </div>

              <div className="dmm-card-content">{mem.content}</div>

              <div className="dmm-meta">
                <span>{t('memories.importance', { value: mem.importance })}</span>
                <span>·</span>
                <span>{t('memories.retrievals', { count: mem.retrievalCount })}</span>
                <span>·</span>
                <span>{mem.sourceKind}</span>
                {mem.backingFiles.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{mem.backingFiles.join(', ')}</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editor && (
        <div
          className="dmm-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={editor.mode === 'create' ? t('modal.createTitle') : t('modal.editTitle', { id: editor.id })}
          onClick={e => {
            if (e.target === e.currentTarget) setEditor(null)
          }}
        >
          <form className="dmm-modal" onSubmit={e => void handleSave(e)}>
            <div className="dmm-row-between">
              <strong>
                {editor.mode === 'create' ? t('modal.createTitle') : t('modal.editTitle', { id: editor.id })}
              </strong>
              <button type="button" className="dmm-btn dmm-btn-ghost" onClick={() => setEditor(null)}>
                ✕
              </button>
            </div>

            {editor.mode === 'create' && (
              <div className="dmm-field">
                <label className="dmm-label" htmlFor="dmm-scope">
                  {t('modal.scope')}
                </label>
                <select
                  id="dmm-scope"
                  className="dmm-select"
                  value={editor.scope}
                  onChange={e => {
                    const nextScope = e.target.value as MemoryScope
                    setEditor({
                      ...editor,
                      scope: nextScope,
                      category: nextScope === 'global' ? 'USER_PROFILE' : 'PROJECT_RULES',
                    })
                  }}
                >
                  <option value="project">{t('memories.scopeProject')}</option>
                  <option value="global">{t('memories.scopeGlobal')}</option>
                </select>
              </div>
            )}

            {editor.scope !== 'global' && (
              <div className="dmm-field">
                <label className="dmm-label" htmlFor="dmm-category">
                  {t('modal.category')}
                </label>
                <select
                  id="dmm-category"
                  className="dmm-select"
                  value={editor.category}
                  onChange={e => setEditor({ ...editor, category: e.target.value as MemoryCategory })}
                >
                  {PROJECT_MEMORY_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="dmm-field">
              <label className="dmm-label" htmlFor="dmm-importance">
                {t('modal.importance')}: {editor.importance}
              </label>
              <input
                id="dmm-importance"
                type="range"
                min={1}
                max={100}
                value={editor.importance}
                onChange={e => setEditor({ ...editor, importance: Number(e.target.value) })}
              />
            </div>

            <label className="dmm-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={editor.pinned}
                onChange={e => setEditor({ ...editor, pinned: e.target.checked })}
              />
              <span>{t('modal.pinLabel')}</span>
            </label>

            <div className="dmm-field">
              <label className="dmm-label" htmlFor="dmm-content">
                {t('modal.content')}
              </label>
              <textarea
                id="dmm-content"
                className="dmm-textarea"
                rows={4}
                required
                placeholder={t('modal.contentPlaceholder')}
                value={editor.content}
                onChange={e => setEditor({ ...editor, content: e.target.value })}
              />
            </div>

            <div className="dmm-row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="dmm-btn" onClick={() => setEditor(null)}>
                {t('modal.cancel')}
              </button>
              <button type="submit" className="dmm-btn dmm-btn-primary" disabled={saving || editor.content.trim().length === 0}>
                {t('modal.save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
