import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './MediaFormPage.css'

const TYPE_OPTIONS = ['LIVE', 'REPLAY', 'INTERVIEW', 'PROMO']
const TYPE_LABELS: Record<string, string> = {
  LIVE: 'Live',
  REPLAY: 'Replay',
  INTERVIEW: 'Interview',
  PROMO: 'Promo',
}

const GAME_TYPE_LABELS: Record<string, string> = {
  ENHANCED: 'Enhanced Games Event',
  BREAKER: 'Breakers Event',
}

type LinkOption = {
  id: string
  label: string
  subtitle: string
}

type ModalTab = 'games' | 'events' | 'heats' | 'athletes'

export default function MediaFormPage() {
  const { mediaId } = useParams()
  const isEditing = Boolean(mediaId)
  const navigate = useNavigate()

  const [mediaType, setMediaType] = useState('')
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  const [gameId, setGameId] = useState<string | null>(null)
  const [gameLabel, setGameLabel] = useState<string | null>(null)
  const [eventId, setEventId] = useState<number | null>(null)
  const [eventLabel, setEventLabel] = useState<string | null>(null)
  const [heatId, setHeatId] = useState<string | null>(null)
  const [heatLabel, setHeatLabel] = useState<string | null>(null)
  const [athleteId, setAthleteId] = useState<string | null>(null)
  const [athleteLabel, setAthleteLabel] = useState<string | null>(null)

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<ModalTab>('games')
  const [tabOptions, setTabOptions] = useState<Record<ModalTab, LinkOption[]>>({
    games: [],
    events: [],
    heats: [],
    athletes: [],
  })
  const [tabLoaded, setTabLoaded] = useState<Record<ModalTab, boolean>>({
    games: false,
    events: false,
    heats: false,
    athletes: false,
  })
  const [loadingTab, setLoadingTab] = useState(false)

  useEffect(() => {
    if (!isEditing) return

    async function fetchMedia() {
      const { data, error } = await supabase
        .from('event_media')
        .select('*')
        .eq('em_id', mediaId)
        .single()

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setMediaType(data.media_type ?? '')
      setDescription(data.media_text ?? '')
      setSourceUrl(data.media_url ?? '')
      setGameId(data.game_id ?? null)
      setEventId(data.event_id ?? null)
      setHeatId(data.heat_id ?? null)
      setAthleteId(data.athlete_id ?? null)

      if (data.game_id) {
        const { data: g } = await supabase
          .from('games')
          .select('game_name')
          .eq('game_id', data.game_id)
          .single()
        setGameLabel(g?.game_name ?? data.game_id)
      }
      if (data.event_id != null) {
        const { data: e } = await supabase
          .from('events')
          .select('event_name')
          .eq('event_id', data.event_id)
          .single()
        setEventLabel(e?.event_name ?? String(data.event_id))
      }
      if (data.athlete_id) {
        const { data: a } = await supabase
          .from('athletes')
          .select('display_name')
          .eq('athlete_id', data.athlete_id)
          .single()
        setAthleteLabel(a?.display_name ?? data.athlete_id)
      }
      if (data.heat_id) {
        const label = await resolveHeatLabel(data.heat_id)
        setHeatLabel(label)
      }

      setLoading(false)
    }

    fetchMedia()
  }, [mediaId, isEditing])

  async function resolveHeatLabel(hid: string): Promise<string> {
    const { data: heat } = await supabase
      .from('heats')
      .select('ge_list_id, order_no')
      .eq('heat_id', hid)
      .single()
    if (!heat) return hid

    const { data: gel } = await supabase
      .from('game_events_list')
      .select('game_id, event_id')
      .eq('ge_list_id', heat.ge_list_id)
      .single()

    let gameName = '—'
    let eventName = '—'
    if (gel?.game_id) {
      const { data: g } = await supabase.from('games').select('game_name').eq('game_id', gel.game_id).single()
      gameName = g?.game_name ?? gel.game_id
    }
    if (gel?.event_id != null) {
      const { data: e } = await supabase
        .from('events')
        .select('event_name')
        .eq('event_id', gel.event_id)
        .single()
      eventName = e?.event_name ?? String(gel.event_id)
    }

    const heatLabelPart = heat.order_no != null ? `Heat ${heat.order_no}` : 'Heat'
    return `${gameName} · ${eventName} · ${heatLabelPart}`
  }

  async function ensureTabLoaded(tab: ModalTab) {
    if (tabLoaded[tab]) return
    setLoadingTab(true)

    if (tab === 'games') {
      const { data } = await supabase.from('games').select('game_id, game_name, game_type')
      const options: LinkOption[] = (data ?? []).map((g) => ({
        id: g.game_id,
        label: g.game_name,
        subtitle: GAME_TYPE_LABELS[g.game_type] ?? g.game_type,
      }))
      setTabOptions((prev) => ({ ...prev, games: options }))
    }

    if (tab === 'events') {
      const { data } = await supabase.from('events').select('event_id, event_name, sport')
      const options: LinkOption[] = (data ?? []).map((e) => ({
        id: String(e.event_id),
        label: e.event_name,
        subtitle: e.sport ?? '',
      }))
      setTabOptions((prev) => ({ ...prev, events: options }))
    }

    if (tab === 'athletes') {
      const { data } = await supabase.from('athletes').select('athlete_id, display_name, sport')
      const options: LinkOption[] = (data ?? []).map((a) => ({
        id: a.athlete_id,
        label: a.display_name ?? a.athlete_id,
        subtitle: a.sport ?? '',
      }))
      setTabOptions((prev) => ({ ...prev, athletes: options }))
    }

    if (tab === 'heats') {
      const [{ data: heatsData }, { data: gelData }, { data: gamesData }, { data: eventsData }] =
        await Promise.all([
          supabase.from('heats').select('heat_id, ge_list_id, order_no, heat_type'),
          supabase.from('game_events_list').select('ge_list_id, game_id, event_id'),
          supabase.from('games').select('game_id, game_name'),
          supabase.from('events').select('event_id, event_name'),
        ])

      const gelMap: Record<number, { game_id: string | null; event_id: number | null }> = {}
      ;(gelData ?? []).forEach((g) => {
        gelMap[g.ge_list_id] = { game_id: g.game_id, event_id: g.event_id }
      })
      const gameNameMap: Record<string, string> = {}
      ;(gamesData ?? []).forEach((g) => {
        gameNameMap[g.game_id] = g.game_name
      })
      const eventNameMap: Record<number, string> = {}
      ;(eventsData ?? []).forEach((e) => {
        eventNameMap[e.event_id] = e.event_name
      })

      const options: LinkOption[] = (heatsData ?? []).map((h) => {
        const gel = gelMap[h.ge_list_id]
        const gameName = gel?.game_id ? gameNameMap[gel.game_id] ?? gel.game_id : '—'
        const eventName = gel?.event_id != null ? eventNameMap[gel.event_id] ?? String(gel.event_id) : '—'
        const heatLabelPart = h.order_no != null ? `Heat ${h.order_no}` : 'Heat'
        return {
          id: h.heat_id,
          label: `${gameName} · ${eventName} · ${heatLabelPart}`,
          subtitle: h.heat_type ?? '',
        }
      })
      setTabOptions((prev) => ({ ...prev, heats: options }))
    }

    setTabLoaded((prev) => ({ ...prev, [tab]: true }))
    setLoadingTab(false)
  }

  function openModal() {
    setShowModal(true)
    setActiveTab('games')
    ensureTabLoaded('games')
  }

  function switchTab(tab: ModalTab) {
    setActiveTab(tab)
    ensureTabLoaded(tab)
  }

  function handleAddLink(tab: ModalTab, option: LinkOption) {
    if (tab === 'games') {
      setGameId(option.id)
      setGameLabel(option.label)
    }
    if (tab === 'events') {
      setEventId(Number(option.id))
      setEventLabel(option.label)
    }
    if (tab === 'heats') {
      setHeatId(option.id)
      setHeatLabel(option.label)
    }
    if (tab === 'athletes') {
      setAthleteId(option.id)
      setAthleteLabel(option.label)
    }
  }

  function removeLink(kind: ModalTab) {
    if (kind === 'games') {
      setGameId(null)
      setGameLabel(null)
    }
    if (kind === 'events') {
      setEventId(null)
      setEventLabel(null)
    }
    if (kind === 'heats') {
      setHeatId(null)
      setHeatLabel(null)
    }
    if (kind === 'athletes') {
      setAthleteId(null)
      setAthleteLabel(null)
    }
  }

  function isSelected(tab: ModalTab, id: string) {
    if (tab === 'games') return gameId === id
    if (tab === 'events') return eventId === Number(id)
    if (tab === 'heats') return heatId === id
    if (tab === 'athletes') return athleteId === id
    return false
  }

  async function handleSave() {
    setError(null)

    if (!mediaType) {
      setError('Please select a type.')
      return
    }

    setSaving(true)

    const payload = {
      media_type: mediaType,
      media_text: description || null,
      media_url: sourceUrl || null,
      game_id: gameId,
      event_id: eventId,
      heat_id: heatId,
      athlete_id: athleteId,
    }

    if (isEditing) {
      const { error } = await supabase.from('event_media').update(payload).eq('em_id', mediaId)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('event_media').insert(payload)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/media')
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Media" title="Media" />
        <p className="media-state-message">Loading…</p>
      </div>
    )
  }

  const hasAnyLink = gameId || eventId != null || heatId || athleteId

  return (
    <div>
      <PageHeader breadcrumb="Media" title="Media" />

      <div className="media-form-page">
        <div className="media-form-toolbar">
          <div className="media-form-breadcrumb">
            Media / <strong>{isEditing ? 'Edit Media' : 'Add Media'}</strong>
          </div>
          <div className="media-toolbar-actions">
            <button className="media-btn-secondary" onClick={() => navigate('/media')}>
              Cancel
            </button>
            <button className="media-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <p className="media-form-error">{error}</p>}

        <div className="media-form-content">
          <div className="media-card">
            <h2>Media Details</h2>
            <p className="media-card-subtitle">Type, description and source URL for this media item.</p>

            <div className="media-field-row">
              <div>
                <label className="media-field-label">Type</label>
                <select
                  className="media-field-input"
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                >
                  <option value="">Select type</option>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="media-field-label">Description</label>
                <input
                  type="text"
                  className="media-field-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            <label className="media-field-label">Source URL</label>
            <input
              type="text"
              className="media-field-input"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="youtube.com/watch?v=..."
            />
          </div>

          <div className="media-card">
            <div className="media-card-header-row">
              <div>
                <h2>Linked To</h2>
                <p className="media-card-subtitle">
                  Link this item to any combination of a game, event, heat and athlete.
                </p>
              </div>
              <button className="media-btn-secondary media-add-link-btn" onClick={openModal}>
                + Add Link
              </button>
            </div>

            {hasAnyLink ? (
              <div className="media-linked-chip-row">
                {gameId && (
                  <span className="media-linked-chip media-chip-game">
                    {gameLabel ?? gameId}
                    <span className="media-chip-remove" onClick={() => removeLink('games')}>
                      ✕
                    </span>
                  </span>
                )}
                {eventId != null && (
                  <span className="media-linked-chip media-chip-event">
                    {eventLabel ?? eventId}
                    <span className="media-chip-remove" onClick={() => removeLink('events')}>
                      ✕
                    </span>
                  </span>
                )}
                {heatId && (
                  <span className="media-linked-chip media-chip-heat">
                    {heatLabel ?? heatId}
                    <span className="media-chip-remove" onClick={() => removeLink('heats')}>
                      ✕
                    </span>
                  </span>
                )}
                {athleteId && (
                  <span className="media-linked-chip media-chip-athlete">
                    {athleteLabel ?? athleteId}
                    <span className="media-chip-remove" onClick={() => removeLink('athletes')}>
                      ✕
                    </span>
                  </span>
                )}
              </div>
            ) : (
              <p className="media-state-message">
                Nothing linked yet — use "+ Add Link" to connect this media to a game, event, heat or athlete.
              </p>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="media-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="media-modal" onClick={(e) => e.stopPropagation()}>
            <div className="media-modal-header">
              <h2>Add Link</h2>
              <span className="media-modal-close" onClick={() => setShowModal(false)}>
                Close ✕
              </span>
            </div>

            <div className="media-modal-tabs">
              {(['games', 'events', 'heats', 'athletes'] as ModalTab[]).map((tab) => (
                <button
                  key={tab}
                  className={'media-tab-btn' + (activeTab === tab ? ' media-tab-btn-active' : '')}
                  onClick={() => switchTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="media-modal-body">
              {loadingTab && !tabLoaded[activeTab] && <p className="media-state-message">Loading…</p>}
              {tabOptions[activeTab].map((opt) => {
                const selected = isSelected(activeTab, opt.id)
                return (
                  <div className="media-modal-row" key={opt.id}>
                    <div className="media-modal-row-info">
                      <div className="media-modal-row-name">{opt.label}</div>
                      {opt.subtitle && <div className="media-modal-row-subtitle">{opt.subtitle}</div>}
                    </div>
                    <button
                      className="media-btn-link"
                      onClick={() => handleAddLink(activeTab, opt)}
                      disabled={selected}
                    >
                      {selected ? 'Added' : '+ Add'}
                    </button>
                  </div>
                )
              })}
              {tabLoaded[activeTab] && tabOptions[activeTab].length === 0 && (
                <p className="media-state-message">Nothing available here yet.</p>
              )}
            </div>

            <div className="media-modal-footer">
              <button className="media-btn-primary" onClick={() => setShowModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
