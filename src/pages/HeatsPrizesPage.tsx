import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './HeatsPrizesPage.css'

type Game = { game_id: string; game_name: string }
type EventRow = { event_id: number; event_name: string; official_wr: number | null; enhanced_wr: number | null; sport: string | null; event_category: string | null }
type GameEventLink = {
  ge_list_id: number
  game_id: string
  event_id: number
  prize_wr: number | null
  prize_1: number | null
  prize_2: number | null
  prize_3: number | null
  prize_4: number | null
  prize_5: number | null
  prize_6: number | null
  current_wr_record: number | null
  current_enhanced_record: number | null
}
type HeatRow = {
  heat_id: string
  ge_list_id: number
  heat_type: string
  date: string | null
  heat_status: string | null
  order_no: number | null
}
type Athlete = { athlete_id: string; display_name: string; sport: string | null }
type AthleteHeatRow = { heat_id: string; athlete_id: string }

const TIME_SPORTS = ['SWIMMING', 'TRACK']

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatRecord(value: number | null, sport: string | null) {
  if (value === null || value === undefined) return '—'
  if (sport && TIME_SPORTS.includes(sport.toUpperCase())) {
    if (value < 60) return `${value}s`
    const minutes = Math.floor(value / 60)
    const seconds = (value % 60).toFixed(2).padStart(5, '0')
    return `${minutes}:${seconds}`
  }
  return `${value}kg`
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return ''
  return `$${value.toLocaleString('en-US')}`
}

function eventSubtitle(ev: EventRow) {
  const sport = ev.sport ? toTitleCase(ev.sport) : '—'
  const category = ev.event_category ? toTitleCase(ev.event_category) : '—'
  return `${sport} · ${category}`
}

function parseMoney(text: string): number | null {
  const digits = text.replace(/[^\d.]/g, '')
  if (!digits) return null
  const num = parseFloat(digits)
  return isNaN(num) ? null : num
}

export default function HeatsPrizesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [links, setLinks] = useState<GameEventLink[]>([])
  const [heats, setHeats] = useState<HeatRow[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [athleteHeats, setAthleteHeats] = useState<AthleteHeatRow[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [expandedGameId, setExpandedGameId] = useState<string | null>(null)
  const [selectedGeListId, setSelectedGeListId] = useState<number | null>(null)
  const [addEventModalGameId, setAddEventModalGameId] = useState<string | null>(null)
  const [addingEventId, setAddingEventId] = useState<number | null>(null)
  const [manageHeatId, setManageHeatId] = useState<string | null>(null)
  const [draggedAthleteId, setDraggedAthleteId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAll() {
      const [gamesRes, eventsRes, linksRes, heatsRes, athletesRes, athleteHeatsRes] = await Promise.all([
        supabase.from('games').select('game_id, game_name'),
        supabase.from('events').select('event_id, event_name, official_wr, enhanced_wr, sport, event_category'),
        supabase.from('game_events_list').select('*'),
        supabase.from('heats').select('*'),
        supabase.from('athletes').select('athlete_id, display_name, sport'),
        supabase.from('athlete_heats').select('heat_id, athlete_id'),
      ])

      const firstError =
        gamesRes.error ||
        eventsRes.error ||
        linksRes.error ||
        heatsRes.error ||
        athletesRes.error ||
        athleteHeatsRes.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setGames(gamesRes.data ?? [])
      setEvents(eventsRes.data ?? [])
      setLinks(linksRes.data ?? [])
      setHeats(
        (heatsRes.data ?? []).sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
      )
      setAthletes(athletesRes.data ?? [])
      setAthleteHeats(athleteHeatsRes.data ?? [])

      if (gamesRes.data && gamesRes.data.length > 0) {
        setExpandedGameId(gamesRes.data[0].game_id)
      }

      setLoading(false)
    }

    fetchAll()
  }, [])

  const eventName = (id: number) => events.find((e) => e.event_id === id)?.event_name ?? `Event #${id}`

  const linksByGame = useMemo(() => {
    const map: Record<string, GameEventLink[]> = {}
    for (const link of links) {
      if (!map[link.game_id]) map[link.game_id] = []
      map[link.game_id].push(link)
    }
    return map
  }, [links])

  const selectedLink = links.find((l) => l.ge_list_id === selectedGeListId) ?? null
  const selectedEvent = selectedLink ? events.find((e) => e.event_id === selectedLink.event_id) : null
  const selectedGame = selectedLink ? games.find((g) => g.game_id === selectedLink.game_id) : null

  const heatsForSelected = selectedGeListId
    ? heats.filter((h) => h.ge_list_id === selectedGeListId)
    : []

  async function updateLinkField(field: keyof GameEventLink, rawValue: string) {
    if (!selectedLink) return
    const value = parseMoney(rawValue)

    setLinks((prev) =>
      prev.map((l) => (l.ge_list_id === selectedLink.ge_list_id ? { ...l, [field]: value } : l))
    )

    const { error } = await supabase
      .from('game_events_list')
      .update({ [field]: value })
      .eq('ge_list_id', selectedLink.ge_list_id)

    if (error) setSaveError(error.message)
  }

  async function handleRemoveEvent(geListId: number) {
    setSaveError(null)

    const { error } = await supabase
      .from('game_events_list')
      .delete()
      .eq('ge_list_id', geListId)

    if (error) {
      setSaveError(error.message)
      return
    }

    setLinks((prev) => prev.filter((l) => l.ge_list_id !== geListId))
    if (selectedGeListId === geListId) {
      setSelectedGeListId(null)
    }
  }

  async function handleAddEvent(gameId: string, eventId: number) {
    setAddingEventId(eventId)
    setSaveError(null)

    const { data, error } = await supabase
      .from('game_events_list')
      .insert({ game_id: gameId, event_id: eventId })
      .select()
      .single()

    if (error) {
      setSaveError(error.message)
      setAddingEventId(null)
      return
    }

    setLinks((prev) => [...prev, data])
    setAddingEventId(null)
  }

  const athleteCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const row of athleteHeats) {
      counts[row.heat_id] = (counts[row.heat_id] ?? 0) + 1
    }
    return counts
  }, [athleteHeats])

  const manageHeat = heats.find((h) => h.heat_id === manageHeatId) ?? null
  const manageHeatLink = manageHeat ? links.find((l) => l.ge_list_id === manageHeat.ge_list_id) : null
  const manageHeatEvent = manageHeatLink
    ? events.find((e) => e.event_id === manageHeatLink.event_id)
    : null
  const manageHeatGame = manageHeatLink
    ? games.find((g) => g.game_id === manageHeatLink.game_id)
    : null
  const manageHeatIndex = manageHeat
    ? heats.filter((h) => h.ge_list_id === manageHeat.ge_list_id).indexOf(manageHeat) + 1
    : 0

  const assignedAthleteIds = new Set(
    athleteHeats.filter((r) => r.heat_id === manageHeatId).map((r) => r.athlete_id)
  )
  const availableAthletes = athletes.filter(
    (a) => a.sport === (manageHeatEvent?.sport ?? null) && !assignedAthleteIds.has(a.athlete_id)
  )
  const assignedAthletes = athletes.filter((a) => assignedAthleteIds.has(a.athlete_id))

  async function assignAthlete(athleteId: string) {
    if (!manageHeatId) return
    setSaveError(null)

    const { error } = await supabase
      .from('athlete_heats')
      .insert({ heat_id: manageHeatId, athlete_id: athleteId })

    if (error) {
      setSaveError(error.message)
      return
    }
    setAthleteHeats((prev) => [...prev, { heat_id: manageHeatId, athlete_id: athleteId }])
  }

  async function unassignAthlete(athleteId: string) {
    if (!manageHeatId) return
    setSaveError(null)

    const { error } = await supabase
      .from('athlete_heats')
      .delete()
      .eq('heat_id', manageHeatId)
      .eq('athlete_id', athleteId)

    if (error) {
      setSaveError(error.message)
      return
    }
    setAthleteHeats((prev) =>
      prev.filter((r) => !(r.heat_id === manageHeatId && r.athlete_id === athleteId))
    )
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Games / Competitions" title="Heats & Prizes" />
        <p className="state-message">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Heats & Prizes"
        title="Heats & Prizes"
        description="Select a game, then an event, to manage its prize structure, heats and heat line-ups."
      />

      <div className="heats-page-body">
        {error && <p className="state-message error">{error}</p>}
        {saveError && <p className="state-message error">Save failed: {saveError}</p>}

        <div className="heats-grid">
          <div className="game-event-panel">
            {games.map((game) => (
              <div key={game.game_id}>
                <button
                  className="game-header-row"
                  onClick={() =>
                    setExpandedGameId(expandedGameId === game.game_id ? null : game.game_id)
                  }
                >
                  <span className="expand-arrow">
                    {expandedGameId === game.game_id ? '▾' : '▸'}
                  </span>
                  {game.game_name}
                </button>

                {expandedGameId === game.game_id && (
                  <div className="event-list">
                    {(linksByGame[game.game_id] ?? []).map((link) => (
                      <button
                        key={link.ge_list_id}
                        className={
                          'event-row' +
                          (selectedGeListId === link.ge_list_id ? ' event-row-active' : '')
                        }
                        onClick={() => setSelectedGeListId(link.ge_list_id)}
                      >
                        {eventName(link.event_id)}
                        <span
                          className="remove-x"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveEvent(link.ge_list_id)
                          }}
                        >
                          ×
                        </span>
                      </button>
                    ))}
                    <button
                      className="add-event-row"
                      onClick={() => setAddEventModalGameId(game.game_id)}
                    >
                      + Add Event
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="event-detail-panel">
            {!selectedLink && (
              <p className="state-message">Select an event on the left to manage it.</p>
            )}

            {selectedLink && selectedEvent && (
              <>
                <h2>{selectedEvent.event_name}</h2>
                <p className="card-subtitle">
                  Prize structure for this event within {selectedGame?.game_name}.
                </p>

                <div className="field-row-2">
                  <div>
                    <label className="field-label">Current World Record</label>
                    <input
                      className="field-input"
                      readOnly
                      value={formatRecord(
                        selectedLink.current_wr_record ?? selectedEvent.official_wr,
                        selectedEvent.sport
                      )}
                    />
                  </div>
                  <div>
                    <label className="field-label">Enhanced World Record</label>
                    <input
                      className="field-input"
                      readOnly
                      value={formatRecord(
                        selectedLink.current_enhanced_record ?? selectedEvent.enhanced_wr,
                        selectedEvent.sport
                      )}
                    />
                  </div>
                </div>

                <div className="field-row-prizes">
                  {(['prize_wr', 'prize_1', 'prize_2', 'prize_3', 'prize_4', 'prize_5', 'prize_6'] as const).map(
                    (field, i) => (
                      <div key={field}>
                        <label className="field-label">
                          {i === 0 ? 'WR Prize' : `${i}${['st', 'nd', 'rd'][i - 1] ?? 'th'}`}
                        </label>
                        <input
                          className="field-input"
                          defaultValue={formatMoney(selectedLink[field])}
                          onBlur={(e) => updateLinkField(field, e.target.value)}
                        />
                      </div>
                    )
                  )}
                </div>

                <div className="table-wrap">
                  <table className="heats-table">
                    <thead>
                      <tr>
                        <th>Heat</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Athletes</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {heatsForSelected.map((heat, i) => (
                        <tr key={heat.heat_id}>
                          <td className="heat-name">Heat {i + 1}</td>
                          <td className="muted">{toTitleCase(heat.heat_type)}</td>
                          <td>
                            <span
                              className={`status-badge status-${(heat.heat_status ?? '').toLowerCase()}`}
                            >
                              {heat.heat_status}
                            </span>
                          </td>
                          <td className="muted">{athleteCounts[heat.heat_id] ?? 0}</td>
                          <td className="row-actions">
                            <button
                              className="btn-link"
                              onClick={() => setManageHeatId(heat.heat_id)}
                            >
                              Manage Athletes
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {heatsForSelected.length === 0 && (
                    <p className="state-message">No heats scheduled for this event yet.</p>
                  )}
                </div>

                <p className="table-footnote">
                  Click a heat row to see its athletes and results below. Click "Manage Athletes"
                  to assign athletes — drag between columns, or use Add / Remove.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {addEventModalGameId && (
        <div className="modal-overlay" onClick={() => setAddEventModalGameId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>
                  Add Event — {games.find((g) => g.game_id === addEventModalGameId)?.game_name}
                </h2>
                <p className="card-subtitle">Choose an event from the catalogue to link to this game.</p>
              </div>
              <button className="modal-close" onClick={() => setAddEventModalGameId(null)}>
                Close ×
              </button>
            </div>

            <div className="modal-event-list">
              {events
                .filter(
                  (ev) =>
                    !(linksByGame[addEventModalGameId] ?? []).some(
                      (l) => l.event_id === ev.event_id
                    )
                )
                .map((ev) => (
                  <div className="modal-event-row" key={ev.event_id}>
                    <div>
                      <div className="modal-event-name">{ev.event_name}</div>
                      <div className="modal-event-subtitle">{eventSubtitle(ev)}</div>
                    </div>
                    <button
                      className="modal-add-btn"
                      disabled={addingEventId === ev.event_id}
                      onClick={() => handleAddEvent(addEventModalGameId, ev.event_id)}
                    >
                      {addingEventId === ev.event_id ? 'Adding…' : '+ Add'}
                    </button>
                  </div>
                ))}

              {events.filter(
                (ev) =>
                  !(linksByGame[addEventModalGameId] ?? []).some((l) => l.event_id === ev.event_id)
              ).length === 0 && (
                <p className="state-message">Every event is already linked to this game.</p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setAddEventModalGameId(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {manageHeatId && manageHeatEvent && (
        <div className="modal-overlay" onClick={() => setManageHeatId(null)}>
          <div className="modal-card modal-card-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Assign Athletes — Heat {manageHeatIndex}</h2>
                <p className="card-subtitle">
                  {manageHeatEvent.event_name} · {manageHeatGame?.game_name}
                </p>
              </div>
              <button className="modal-close" onClick={() => setManageHeatId(null)}>
                Close ×
              </button>
            </div>

            <div className="assign-columns">
              <div
                className="assign-panel"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedAthleteId) unassignAthlete(draggedAthleteId)
                  setDraggedAthleteId(null)
                }}
              >
                <div className="assign-panel-label">
                  Available — {manageHeatEvent.sport ? toTitleCase(manageHeatEvent.sport) : '—'} (
                  {availableAthletes.length})
                </div>
                {availableAthletes.map((a) => (
                  <div
                    className="assign-athlete-row"
                    key={a.athlete_id}
                    draggable
                    onDragStart={() => setDraggedAthleteId(a.athlete_id)}
                    onDragEnd={() => setDraggedAthleteId(null)}
                  >
                    <div className="assign-athlete-info">
                      <div className="assign-avatar" />
                      <span>{a.display_name}</span>
                    </div>
                    <button className="modal-add-btn" onClick={() => assignAthlete(a.athlete_id)}>
                      + Add
                    </button>
                  </div>
                ))}
                {availableAthletes.length === 0 && (
                  <p className="state-message">No available athletes for this sport.</p>
                )}
              </div>

              <div
                className="assign-panel assign-panel-active"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggedAthleteId) assignAthlete(draggedAthleteId)
                  setDraggedAthleteId(null)
                }}
              >
                <div className="assign-panel-label">In This Heat ({assignedAthletes.length})</div>
                {assignedAthletes.map((a) => (
                  <div
                    className="assign-athlete-row"
                    key={a.athlete_id}
                    draggable
                    onDragStart={() => setDraggedAthleteId(a.athlete_id)}
                    onDragEnd={() => setDraggedAthleteId(null)}
                  >
                    <div className="assign-athlete-info">
                      <div className="assign-avatar" />
                      <span>{a.display_name}</span>
                    </div>
                    <button
                      className="modal-add-btn"
                      onClick={() => unassignAthlete(a.athlete_id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {assignedAthletes.length === 0 && (
                  <p className="state-message">Drag athletes here, or click + Add.</p>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setManageHeatId(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => setManageHeatId(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
