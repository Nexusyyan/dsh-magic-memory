import React, { useEffect, useState } from 'react'
import type { NoteRecord, SessionEpisodeRecord } from '../../shared/types.js'
import type { MagicMemoryApi } from '../api.js'
import type { TranslateFn } from '../locales.js'

export interface EpisodesNotesTabProps {
  api: MagicMemoryApi
  projectId: string
  sessionId?: string
  t: TranslateFn
  refreshToken: number
  onMutated: () => void
  onError: (msg: string) => void
  onNotice: (msg: string) => void
}

function formatShortTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(ts)
  }
}

export function EpisodesNotesTab({
  api,
  projectId,
  sessionId,
  t,
  refreshToken,
  onMutated,
  onError,
  onNotice,
}: EpisodesNotesTabProps): React.ReactElement {
  const [episodes, setEpisodes] = useState<SessionEpisodeRecord[]>([])
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)

  const [showAddNote, setShowAddNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteSessionOnly, setNoteSessionOnly] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    Promise.all([
      api.listEpisodes({ projectId, limit: 40 }, controller.signal),
      api.listNotes({ projectId, includeDismissed: false }, controller.signal),
    ])
      .then(([epRes, noteRes]) => {
        if (!controller.signal.aborted) {
          setEpisodes(epRes.episodes)
          setNotes(noteRes.notes)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) onError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [api, projectId, refreshToken, onError])

  const handleExtract = async () => {
    if (!sessionId) {
      onNotice(t('episodes.noSession'))
      return
    }
    setExtracting(true)
    try {
      const res = await api.extractNow({ projectId, sessionId })
      if (res.status === 'extracted') {
        onNotice(
          `Extracted episode "${res.episode?.title ?? ''}" (+${res.factsPromoted} facts, ${res.factsDeduplicated} deduped, ${res.observationsRecorded} observations)`,
        )
        onMutated()
      } else {
        onNotice(res.reason ?? `Extraction ${res.status}`)
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setExtracting(false)
    }
  }

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteTitle.trim() || !noteContent.trim()) return
    try {
      await api.createNote({
        projectId,
        sessionId,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        sessionOnly: noteSessionOnly,
      })
      setNoteTitle('')
      setNoteContent('')
      setNoteSessionOnly(false)
      setShowAddNote(false)
      onNotice('Note saved')
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDismissNote = async (id: number) => {
    try {
      await api.dismissNote({ projectId, id })
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="dmm-row-between">
        <span className="dmm-section-title">{t('notes.title')}</span>
        <div className="dmm-row">
          <button type="button" className="dmm-btn" onClick={() => setShowAddNote(v => !v)}>
            + {t('notes.add')}
          </button>
          <button
            type="button"
            className="dmm-btn dmm-btn-primary"
            disabled={extracting || !sessionId}
            title={!sessionId ? t('episodes.noSession') : undefined}
            onClick={() => void handleExtract()}
          >
            {extracting ? t('episodes.extracting') : t('episodes.extractNow')}
          </button>
        </div>
      </div>

      {showAddNote && (
        <form className="dmm-card" onSubmit={e => void handleCreateNote(e)}>
          <input
            type="text"
            className="dmm-input"
            required
            placeholder={t('notes.titlePlaceholder')}
            value={noteTitle}
            onChange={e => setNoteTitle(e.target.value)}
          />
          <textarea
            className="dmm-textarea"
            rows={3}
            required
            placeholder={t('notes.contentPlaceholder')}
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
          />
          <div className="dmm-row-between">
            <label className="dmm-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={noteSessionOnly}
                onChange={e => setNoteSessionOnly(e.target.checked)}
              />
              <span>{t('notes.sessionOnly')}</span>
            </label>
            <button type="submit" className="dmm-btn dmm-btn-primary">
              {t('notes.save')}
            </button>
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        <div className="dmm-empty">{loading ? t('header.loading') : t('notes.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notes.map(note => (
            <div key={note.id} className="dmm-card">
              <div className="dmm-row-between">
                <strong>
                  #{note.id} {note.title}
                </strong>
                <button
                  type="button"
                  className="dmm-btn dmm-btn-ghost dmm-btn-danger"
                  onClick={() => void handleDismissNote(note.id)}
                >
                  {t('notes.dismiss')}
                </button>
              </div>
              <div className="dmm-card-content">{note.content}</div>
              <div className="dmm-meta">
                <span>{formatShortTime(note.updatedAt)}</span>
                {note.sessionId && <span>· session {note.sessionId.slice(0, 8)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <span className="dmm-section-title">{t('episodes.title')}</span>

      {episodes.length === 0 ? (
        <div className="dmm-empty">{loading ? t('header.loading') : t('episodes.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {episodes.map(ep => (
            <article key={ep.id} className="dmm-card">
              <div className="dmm-row-between">
                <strong>{ep.title}</strong>
                <div className="dmm-row">
                  <span className="dmm-badge dmm-badge-accent">{ep.episodeType}</span>
                  <span className="dmm-badge">imp {ep.importance}</span>
                </div>
              </div>
              <div className="dmm-card-content">{ep.summary}</div>
              {ep.keyDecisions.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--dmm-fg-muted)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>{t('episodes.decisions')}:</div>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {ep.keyDecisions.map((d, idx) => (
                      <li key={idx}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="dmm-meta">
                <span>session {ep.sessionId.slice(0, 8)}</span>
                <span>·</span>
                <span>seq {ep.startSeq}–{ep.endSeq}</span>
                <span>·</span>
                <span>{formatShortTime(ep.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
