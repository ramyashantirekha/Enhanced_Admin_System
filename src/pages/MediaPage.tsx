import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './MediaPage.css'

type MediaRow = {
  em_id: number
  game_id: string | null
  event_id: number | null
  heat_id: string | null
  athlete_id: string | null
  media_type: string
  media_text: string | null
  media_url: string | null
}

type Badge = {
  kind: 'game' | 'event' | 'heat' | 'athlete'
  label: string
}

const TYPE_LABELS: Record<string, string> = {
  LIVE: 'Live',
  REPLAY: 'Replay',
  INTERVIEW: 'Interview',
  PROMO: 'Promo',
}

function typeLabel(code: string) {
  return TYPE_LABELS[code] ?? code
}

export default function MediaPage() {
  const navigate = useNavigate()

  const [rows, setRows] = useState<MediaRow[]>([])
  const [gameNames, setGameNames] = useState<Record<string, string>>({})
  const [eventNames, setEventNames] = useState<Record<number, string>>({})
  const [athleteNames, setAthleteNames] = useState<Record<string, string>>({})
  const [heatBreadcrumbs, setHeatBreadcrumbs] = useState<Record<string, string>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMedia()
  }, [])

  async function loadMedia() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('event_media')
      .select('em_id, game_id, event_id, heat_id, athlete_id, media_type, media_text, media_url')
      .order('em_id', { ascending: false })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const mediaRows = data ?? []

    const gameIds = new Set<string>()
    const eventIds = new Set<number>()
    const athleteIds = new Set<string>()
    const heatIds = new Set<string>()

    mediaRows.forEach((r) => {
      if (r.game_id) gameIds.add(r.game_id)
      if (r.event_id != null) eventIds.add(r.event_id)
      if (r.athlete_id) athleteIds.add(r.athlete_id)
      if (r.heat_id) heatIds.add(r.heat_id)
    })

    // Resolve heat_id -> { ge_list_id, order_no } -> game_id/event_id via game_events_list
    type HeatMeta = { ge_list_id: number; order_no: number | null; game_id: string | null; event_id: number | null }
    const heatMeta: Record<string, HeatMeta> = {}

    if (heatIds.size > 0) {
      const { data: heatsData } = await supabase
        .from('heats')
        .select('heat_id, ge_list_id, order_no')
        .in('heat_id', Array.from(heatIds))

      ;(heatsData ?? []).forEach((h) => {
        heatMeta[h.heat_id] = { ge_list_id: h.ge_list_id, order_no: h.order_no, game_id: null, event_id: null }
      })

      const geListIds = Array.from(new Set(Object.values(heatMeta).map((m) => m.ge_list_id)))
      if (geListIds.length > 0) {
        const { data: gelData } = await supabase
          .from('game_events_list')
          .select('ge_list_id, game_id, event_id')
          .in('ge_list_id', geListIds)

        const gelMap: Record<number, { game_id: string | null; event_id: number | null }> = {}
        ;(gelData ?? []).forEach((g) => {
          gelMap[g.ge_list_id] = { game_id: g.game_id, event_id: g.event_id }
        })

        Object.keys(heatMeta).forEach((hid) => {
          const meta = heatMeta[hid]
          const gel = gelMap[meta.ge_list_id]
          if (gel) {
            meta.game_id = gel.game_id
            meta.event_id = gel.event_id
            if (gel.game_id) gameIds.add(gel.game_id)
            if (gel.event_id != null) eventIds.add(gel.event_id)
          }
        })
      }
    }

    const nextGameNames: Record<string, string> = {}
    if (gameIds.size > 0) {
      const { data: gamesData } = await supabase
        .from('games')
        .select('game_id, game_name')
        .in('game_id', Array.from(gameIds))
      ;(gamesData ?? []).forEach((g) => {
        nextGameNames[g.game_id] = g.game_name
      })
    }

    const nextEventNames: Record<number, string> = {}
    if (eventIds.size > 0) {
      const { data: eventsData } = await supabase
        .from('events')
        .select('event_id, event_name')
        .in('event_id', Array.from(eventIds))
      ;(eventsData ?? []).forEach((e) => {
        nextEventNames[e.event_id] = e.event_name
      })
    }

    const nextAthleteNames: Record<string, string> = {}
    if (athleteIds.size > 0) {
      const { data: athletesData } = await supabase
        .from('athletes')
        .select('athlete_id, display_name')
        .in('athlete_id', Array.from(athleteIds))
      ;(athletesData ?? []).forEach((a) => {
        nextAthleteNames[a.athlete_id] = a.display_name ?? a.athlete_id
      })
    }

    const nextHeatBreadcrumbs: Record<string, string> = {}
    Object.entries(heatMeta).forEach(([heatId, meta]) => {
      const gameName = meta.game_id ? nextGameNames[meta.game_id] ?? meta.game_id : '—'
      const eventName = meta.event_id != null ? nextEventNames[meta.event_id] ?? String(meta.event_id) : '—'
      const heatLabel = meta.order_no != null ? `Heat ${meta.order_no}` : 'Heat'
      nextHeatBreadcrumbs[heatId] = `${gameName} · ${eventName} · ${heatLabel}`
    })

    setRows(mediaRows)
    setGameNames(nextGameNames)
    setEventNames(nextEventNames)
    setAthleteNames(nextAthleteNames)
    setHeatBreadcrumbs(nextHeatBreadcrumbs)
    setLoading(false)
  }

  function badgesFor(row: MediaRow): Badge[] {
    const badges: Badge[] = []
    if (row.game_id) {
      badges.push({ kind: 'game', label: gameNames[row.game_id] ?? row.game_id })
    }
    if (row.event_id != null) {
      badges.push({ kind: 'event', label: eventNames[row.event_id] ?? String(row.event_id) })
    }
    if (row.heat_id) {
      badges.push({ kind: 'heat', label: heatBreadcrumbs[row.heat_id] ?? row.heat_id })
    }
    if (row.athlete_id) {
      badges.push({ kind: 'athlete', label: athleteNames[row.athlete_id] ?? row.athlete_id })
    }
    return badges
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Media"
        title="Media"
        description="Livestream links, replays, interviews and promotional content. A media item can be linked to any combination of games, events, heats and athletes."
        action={<button onClick={() => navigate('/media/new')}>+ Add Media</button>}
      />

      <div className="media-page-body">
        {error && <p className="media-state-message media-state-error">{error}</p>}
        {loading && <p className="media-state-message">Loading…</p>}

        {!loading && (
          <div className="media-table-wrap">
            <table className="media-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Linked To</th>
                  <th>URL</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.em_id}>
                    <td>
                      <span className={`media-type-badge media-type-${row.media_type.toLowerCase()}`}>
                        {typeLabel(row.media_type)}
                      </span>
                    </td>
                    <td className="media-description">{row.media_text || '—'}</td>
                    <td className="media-linked-cell">
                      {badgesFor(row).map((b, idx) => (
                        <span key={idx} className={`media-link-badge media-link-${b.kind}`}>
                          {b.label}
                        </span>
                      ))}
                      {badgesFor(row).length === 0 && <span className="media-muted">Not linked</span>}
                    </td>
                    <td className="media-url-cell">{row.media_url || '—'}</td>
                    <td className="media-row-actions">
                      <button className="media-edit-link" onClick={() => navigate(`/media/edit/${row.em_id}`)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="media-state-message">No media items yet.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
