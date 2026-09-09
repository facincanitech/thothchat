import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { displayName } from '../lib/displayName'
import { statusMediaUrl, resizeStatusImage, assertVideoWithinLimit, uploadStatusMedia } from '../lib/status'
import { IconArrowLeft, IconPlus, IconSmile, IconTrash, IconUser } from './icons'
import type { Profile, StatusPost } from '../types'

const BG_COLORS = ['#5865f2', '#e85d75', '#2f9e6b', '#c77b2e', '#8b5cf6', '#0f766e', '#111827', '#7c2d12']
const FONTS = ['inherit', 'Georgia, serif', '"Courier New", monospace', 'cursive']
const STATUS_EMOJIS = ['😀', '😍', '🔥', '🎉', '❤️', '👍', '😂', '😢', '🙏', '✨', '☀️', '🌙']

type StatusGroup = {
  profile: Profile
  items: StatusPost[]
  allViewed: boolean
}

export function StatusView({ me, onBack }: { me: Profile; onBack: () => void }) {
  const [myStatuses, setMyStatuses] = useState<StatusPost[]>([])
  const [groups, setGroups] = useState<StatusGroup[]>([])
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const [viewerQueue, setViewerQueue] = useState<StatusPost[] | null>(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerAuthor, setViewerAuthor] = useState<Profile | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [composerText, setComposerText] = useState('')
  const [composerBg, setComposerBg] = useState(BG_COLORS[0])
  const [composerFont, setComposerFont] = useState(FONTS[0])
  const [composerTextColor, setComposerTextColor] = useState('#ffffff')
  const [showComposerEmoji, setShowComposerEmoji] = useState(false)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    if (!me) return
    const { data, error: err } = await supabase
      .from('statuses')
      .select('*, profile:profiles!statuses_user_id_fkey(id, username, display_name, avatar_url)')
      .order('created_at', { ascending: true })
    if (err) {
      console.error('load statuses failed', err)
      return
    }
    const rows = (data || []) as (StatusPost & { profile: Profile })[]
    const mine = rows.filter((r) => r.user_id === me.id)
    setMyStatuses(mine)

    const byUser = new Map<string, StatusGroup>()
    for (const row of rows) {
      if (row.user_id === me.id) continue
      const existing = byUser.get(row.user_id)
      if (existing) existing.items.push(row)
      else byUser.set(row.user_id, { profile: row.profile, items: [row], allViewed: false })
    }
    setGroups(Array.from(byUser.values()))

    const { data: views } = await supabase.from('status_views').select('status_id').eq('viewer_id', me.id)
    setViewedIds(new Set((views || []).map((v) => v.status_id as string)))
  }

  useEffect(() => {
    load()
  }, [me.id])

  useEffect(() => {
    setGroups((prev) => prev.map((g) => ({ ...g, allViewed: g.items.every((i) => viewedIds.has(i.id)) })))
  }, [viewedIds])

  async function markViewed(statusId: string) {
    if (viewedIds.has(statusId)) return
    setViewedIds((prev) => new Set(prev).add(statusId))
    await supabase.from('status_views').upsert({ status_id: statusId, viewer_id: me.id }, { onConflict: 'status_id,viewer_id' })
  }

  function openViewer(author: Profile, items: StatusPost[], startIndex = 0) {
    setViewerAuthor(author)
    setViewerQueue(items)
    setViewerIndex(startIndex)
  }

  function closeViewer() {
    setViewerQueue(null)
    setViewerAuthor(null)
    setViewerIndex(0)
  }

  useEffect(() => {
    if (!viewerQueue) return
    const current = viewerQueue[viewerIndex]
    if (current) markViewed(current.id)
  }, [viewerQueue, viewerIndex])

  useEffect(() => {
    if (!viewerQueue) return
    const current = viewerQueue[viewerIndex]
    if (!current || current.kind === 'video') return
    const t = setTimeout(() => advanceViewer(), 5000)
    return () => clearTimeout(t)
  }, [viewerQueue, viewerIndex])

  function advanceViewer() {
    if (!viewerQueue) return
    if (viewerIndex < viewerQueue.length - 1) setViewerIndex((i) => i + 1)
    else closeViewer()
  }

  function retreatViewer() {
    if (!viewerQueue) return
    if (viewerIndex > 0) setViewerIndex((i) => i - 1)
  }

  async function deleteStatus(id: string) {
    await supabase.from('statuses').delete().eq('id', id)
    closeViewer()
    load()
  }

  async function pickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    setShowAddMenu(false)
    if (!file || !me) return
    setPosting(true)
    setError(null)
    try {
      const isVideo = file.type.startsWith('video')
      let path: string
      if (isVideo) {
        await assertVideoWithinLimit(file)
        path = await uploadStatusMedia(file, me.id, file.name.split('.').pop() || 'mp4')
      } else {
        const resized = await resizeStatusImage(file)
        path = await uploadStatusMedia(resized, me.id, 'jpg')
      }
      const { error: insErr } = await supabase.from('statuses').insert({
        user_id: me.id,
        kind: isVideo ? 'video' : 'image',
        media_path: path,
      })
      if (insErr) throw insErr
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'falha ao postar status')
    } finally {
      setPosting(false)
    }
  }

  async function postTextStatus() {
    if (!me || !composerText.trim()) return
    setPosting(true)
    setError(null)
    try {
      const { error: insErr } = await supabase.from('statuses').insert({
        user_id: me.id,
        kind: 'text',
        text_content: composerText.trim(),
        bg_color: composerBg,
        text_color: composerTextColor,
        font: composerFont,
      })
      if (insErr) throw insErr
      setShowComposer(false)
      setComposerText('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'falha ao postar status')
    } finally {
      setPosting(false)
    }
  }

  const current = viewerQueue?.[viewerIndex]

  return (
    <>
      <section className="chats">
        <div className="top">
          <button type="button" className="icon-btn" onClick={onBack} style={{ marginRight: 8 }}>
            <IconArrowLeft size={20} />
          </button>
          <div className="brand-lockup">
            <div className="brand">Status</div>
          </div>
        </div>

        <div className="chat-list">
          <div className="chat" style={{ cursor: 'pointer' }} onClick={() => (myStatuses.length ? openViewer(me, myStatuses) : setShowAddMenu((v) => !v))}>
            <div className="photo" style={{ position: 'relative' }}>
              {me.avatar_url ? <img src={me.avatar_url} alt="" /> : <IconUser size={20} />}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowAddMenu((v) => !v) }}
                style={{
                  position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--green)', color: 'var(--on-button,#fff)', border: '2px solid var(--bg-panel)',
                  display: 'grid', placeItems: 'center', cursor: 'pointer',
                }}
              >
                <IconPlus size={12} />
              </button>
            </div>
            <div className="chat-info">
              <div className="row"><div className="name">Meu status</div></div>
              <div className="last-message">{myStatuses.length ? `${myStatuses.length} atualização(ões) · toque pra ver` : 'Clique para atualizar seu status'}</div>
            </div>
          </div>

          {showAddMenu && (
            <div className="chat-config-members" style={{ marginBottom: 8 }}>
              <div className="chat-config-row" style={{ cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                Foto e vídeo
              </div>
              <div className="chat-config-row" style={{ cursor: 'pointer' }} onClick={() => { setShowAddMenu(false); setShowComposer(true) }}>
                Texto
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={pickMedia} />

          {error && <div className="auth-error" style={{ margin: '0 12px 8px' }}>{error}</div>}
          {posting && <div className="empty">Postando...</div>}

          {groups.length > 0 && <div className="filter-label" style={{ padding: '10px 12px 4px', fontSize: '.75rem', color: 'var(--muted)' }}>RECENTE</div>}
          {groups.map((g) => (
            <div key={g.profile.id} className="chat" style={{ cursor: 'pointer' }} onClick={() => openViewer(g.profile, g.items)}>
              <div className="photo" style={{ border: `2px solid ${g.allViewed ? 'var(--muted)' : 'var(--green)'}` }}>
                {g.profile.avatar_url ? <img src={g.profile.avatar_url} alt="" /> : (g.profile.username?.[0] || '?').toUpperCase()}
              </div>
              <div className="chat-info">
                <div className="row"><div className="name">{displayName(g.profile)}</div></div>
                <div className="last-message">{g.items.length} atualização(ões)</div>
              </div>
            </div>
          ))}
          {groups.length === 0 && <div className="empty">Nenhum status recente dos seus amigos</div>}
        </div>
      </section>

      <div className="main" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
        {!viewerQueue && (
          <div className="empty-card">
            <h2>Compartilhe atualizações de status</h2>
            <p>Compartilhe fotos, vídeos e textos que desaparecem após 24 horas.</p>
          </div>
        )}
      </div>

      {showComposer && (
        <div className="modal-backdrop" style={{ zIndex: 200 }} onClick={() => setShowComposer(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420, maxWidth: '92vw', height: '80vh', borderRadius: 16, position: 'relative',
              background: composerBg, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
              <button type="button" className="icon-btn" onClick={() => setShowComposer(false)}><IconArrowLeft size={20} /></button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="icon-btn" onClick={() => setShowComposerEmoji((v) => !v)}><IconSmile size={20} /></button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setComposerBg(BG_COLORS[(BG_COLORS.indexOf(composerBg) + 1) % BG_COLORS.length])}
                  title="Mudar cor de fundo"
                >
                  🎨
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setComposerFont(FONTS[(FONTS.indexOf(composerFont) + 1) % FONTS.length])}
                  title="Mudar fonte"
                >
                  Aa
                </button>
                <input
                  type="color"
                  value={composerTextColor}
                  onChange={(e) => setComposerTextColor(e.target.value)}
                  title="Cor da letra"
                  style={{ width: 32, height: 32, padding: 0, border: 0, background: 'none', cursor: 'pointer' }}
                />
              </div>
            </div>

            {showComposerEmoji && (
              <div className="emoji-picker" style={{ position: 'absolute', top: 56, right: 12, zIndex: 5 }}>
                {STATUS_EMOJIS.map((em) => (
                  <button key={em} type="button" onClick={() => setComposerText((t) => t + em)}>{em}</button>
                ))}
              </div>
            )}

            <textarea
              value={composerText}
              onChange={(e) => setComposerText(e.target.value.slice(0, 700))}
              placeholder="Digite sua atualização de status"
              maxLength={700}
              rows={10}
              style={{
                flex: 1, background: 'transparent', border: 0, outline: 0, resize: 'none',
                color: composerTextColor, fontFamily: composerFont, fontSize: '1.6rem', textAlign: 'center',
                padding: '0 24px', display: 'flex', alignItems: 'center',
              }}
            />

            {error && <div className="auth-error" style={{ margin: 8, textAlign: 'center' }}>{error}</div>}

            <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="send" disabled={!composerText.trim() || posting} onClick={postTextStatus}>
                {posting ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {current && viewerAuthor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.92)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 4, padding: '10px 12px 0' }}>
            {viewerQueue!.map((item, i) => (
              <div key={item.id} style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,.3)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: i < viewerIndex ? '100%' : i === viewerIndex ? '100%' : '0%', background: '#fff', transition: i === viewerIndex ? 'width 5s linear' : 'none' }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 14, color: '#fff' }}>
            <button type="button" className="icon-btn" onClick={closeViewer} style={{ color: '#fff' }}><IconArrowLeft size={20} /></button>
            <div className="photo" style={{ width: 32, height: 32 }}>
              {viewerAuthor.avatar_url ? <img src={viewerAuthor.avatar_url} alt="" /> : (viewerAuthor.username?.[0] || '?').toUpperCase()}
            </div>
            <span style={{ fontWeight: 600 }}>{displayName(viewerAuthor)}</span>
            {viewerAuthor.id === me.id && (
              <button type="button" className="icon-btn" style={{ marginLeft: 'auto', color: '#fff' }} onClick={() => deleteStatus(current.id)}>
                <IconTrash size={18} />
              </button>
            )}
          </div>
          <div
            style={{ flex: 1, position: 'relative', display: 'flex' }}
          >
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              <button type="button" style={{ flex: 1, background: 'none', border: 0, cursor: 'pointer' }} onClick={retreatViewer} aria-label="Anterior" />
              <button type="button" style={{ flex: 1, background: 'none', border: 0, cursor: 'pointer' }} onClick={advanceViewer} aria-label="Próximo" />
            </div>
            <div style={{ margin: 'auto', maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {current.kind === 'text' ? (
                <div
                  style={{
                    width: 420, maxWidth: '90vw', minHeight: 300, borderRadius: 12, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', background: current.bg_color || '#5865f2', color: current.text_color || '#fff',
                    fontFamily: current.font || 'inherit', fontSize: '1.6rem', textAlign: 'center', padding: 24,
                  }}
                >
                  {current.text_content}
                </div>
              ) : current.kind === 'image' ? (
                <img src={statusMediaUrl(current.media_path!)} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8 }} />
              ) : (
                <video
                  src={statusMediaUrl(current.media_path!)}
                  autoPlay
                  playsInline
                  style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 8, pointerEvents: 'auto' }}
                  onEnded={advanceViewer}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
