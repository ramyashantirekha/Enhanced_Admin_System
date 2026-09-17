import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './ResultsEntryPage.css'

type Game = { game_id: string; game_name: string }
type EventRow = {
  event_id: number
  event_name: string
  sport: string | null
  official_wr: number | null
  enhanced_wr: number | null
}
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
  start_time: string | null
  end_time: string | null
  heat_status: string | null
  order_no: number | null
}
type Athlete = { athlete_id: string; display_name: string }
type AthletePB = {
  athlete_id: string
  event_id: number
  pre_enhanced_pb: string | null
  enhanced_pb: string | null
}
type AthleteHeat = {
  heat_id: string
  athlete_id: string
  lane_no: number | null
  result: string | null
  finish_position: string | null
  is_pb: boolean | null
  is_wr: boolean | null
  prize_awarded: number | null
}

const TIME_SPORTS = ['SWIMMING', 'TRACK']
const PRIZE_FIELDS = ['prize_1', 'prize_2', 'prize_3', 'prize_4', 'prize_5', 'prize_6'] as const

function isTimeSport(sport: string | null) {
  return Boolean(sport && TIME_SPORTS.includes(sport.toUpperCase()))
}

// Strips "s"/"kg" suffixes and parses to a plain number for comparison.
function parseNumeric(value: string | null): number | null {
  if (!value) return null
  const num = parseFloat(value.replace(/[^\d.]/g, ''))
  return isNaN(num) ? null : num
}

function formatWithUnit(value: number | null, sport: string | null) {
  if (value === null || value === undefined) return '—'
  return isTimeSport(sport) ? `${value}s` : `${value}kg`
}

function formatMoney(value: number | null) {
  if (!value) return ''
  return `$${value.toLocaleString('en-US')}`
}

// Lower is better for time sports (faster), higher is better otherwise (heavier lift).
function isImprovement(newVal: number | null, benchmark: number | null, sport: string | null) {
  if (newVal === null || benchmark === null) return false
  return isTimeSport(sport) ? newVal < benchmark : newVal > benchmark
}

function timeAgoLabel(dateStr: string | null) {
  return dateStr ?? ''
}

type EditRow = {
  result: string
  finish_position: string
  is_pb: boolean
  is_wr: boolean
}

export default function ResultsEntryPage() {
  const [games, setGames] = useState<Game[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [links, setLinks] = useState<GameEventLink[]>([])
  const [heats, setHeats] = useState<HeatRow[]>([])
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [athletePBs, setAthletePBs] = useState<AthletePB[]>([])
  const [athleteHeats, setAthleteHeats] = useState<AthleteHeat[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [expandedGameId, setExpandedGameId] = useState<string | null>(null)
  const [selectedHeatId, setSelectedHeatId] = useState<string | null>(null)
  const [editRows, setEditRows] = useState<Record<string, EditRow>>({})

  useEffect(() => {
    async function fetchAll() {
      const [gamesRes, eventsRes, linksRes, heatsRes, athletesRes, pbsRes, ahRes] =
        await Promise.all([
          supabase.from('games').select('game_id, game_name'),
          supabase.from('events').select('event_id, event_name, sport, official_wr, enhanced_wr'),
          supabase.from('game_events_list').select('*'),
          supabase.from('heats').select('*'),
          supabase.from('athletes').select('athlete_id, display_name'),
          supabase.from('athlete_pbs').select('athlete_id, event_id, pre_enhanced_pb, enhanced_pb'),
          supabase.from('athlete_heats').select('*'),
        ])

      const firstError =
        gamesRes.error ||
        eventsRes.error ||
        linksRes.error ||
        heatsRes.error ||
        athletesRes.error ||
        pbsRes.error ||
        ahRes.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setGames(gamesRes.data ?? [])
      setEvents(eventsRes.data ?? [])
      setLinks(linksRes.data ?? [])
      setHeats(heatsRes.data ?? [])
      setAthletes(athletesRes.data ?? [])
      setAthletePBs(pbsRes.data ?? [])
      setAthleteHeats(ahRes.data ?? [])

      if (gamesRes.data && gamesRes.data.length > 0) {
        setExpandedGameId(gamesRes.data[0].game_id)
      }

      setLoading(false)
    }

    fetchAll()
  }, [])

  const linkByGeListId = useMemo(() => {
    const map: Record<number, GameEventLink> = {}
    for (const l of links) map[l.ge_list_id] = l
    return map
  }, [links])

  const eventById = useMemo(() => {
    const map: Record<number, EventRow> = {}
    for (const e of events) map[e.event_id] = e
    return map
  }, [events])

  const heatsByGame = useMemo(() => {
    const map: Record<string, HeatRow[]> = {}
    for (const h of heats) {
      const gameId = linkByGeListId[h.ge_list_id]?.game_id
      if (!gameId) continue
      if (!map[gameId]) map[gameId] = []
      map[gameId].push(h)
    }
    for (const gameId in map) {
      map[gameId].sort((a, b) => {
        const dateCompare = (a.date ?? '').localeCompare(b.date ?? '')
        if (dateCompare !== 0) return dateCompare
        return (a.start_time ?? '').localeCompare(b.start_time ?? '')
      })
    }
    return map
  }, [heats, linkByGeListId])

  const heatIndexWithinEvent = (heat: HeatRow) => {
    const siblings = heats
      .filter((h) => h.ge_list_id === heat.ge_list_id)
      .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
    return siblings.indexOf(heat) + 1
  }

  const selectedHeat = heats.find((h) => h.heat_id === selectedHeatId) ?? null
  const selectedLink = selectedHeat ? linkByGeListId[selectedHeat.ge_list_id] : null
  const selectedEvent = selectedLink ? eventById[selectedLink.event_id] : null
  const selectedGame = selectedLink ? games.find((g) => g.game_id === selectedLink.game_id) : null

  const heatAthleteRows = useMemo(() => {
    if (!selectedHeatId) return []
    return athleteHeats
      .filter((ah) => ah.heat_id === selectedHeatId)
      .sort((a, b) => (a.lane_no ?? 0) - (b.lane_no ?? 0))
  }, [athleteHeats, selectedHeatId])

  // Reset the edit buffer whenever the selected heat changes.
  useEffect(() => {
    const initial: Record<string, EditRow> = {}
    for (const row of heatAthleteRows) {
      initial[row.athlete_id] = {
        result: row.result ?? '',
        finish_position: row.finish_position ?? '',
        is_pb: row.is_pb ?? false,
        is_wr: row.is_wr ?? false,
      }
    }
    setEditRows(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHeatId])

  function existingPB(athleteId: string) {
    if (!selectedLink) return null
    const pb = athletePBs.find(
      (p) => p.athlete_id === athleteId && p.event_id === selectedLink.event_id
    )
    if (!pb) return null
    return pb.enhanced_pb ?? pb.pre_enhanced_pb ?? null
  }

  function currentRecord(field: 'current_wr_record' | 'current_enhanced_record', fallback: 'official_wr' | 'enhanced_wr') {
    if (!selectedLink || !selectedEvent) return null
    return selectedLink[field] ?? selectedEvent[fallback] ?? null
  }

  function updateEditRow(athleteId: string, patch: Partial<EditRow>) {
    setEditRows((prev) => ({
      ...prev,
      [athleteId]: { ...prev[athleteId], ...patch },
    }))
  }

  function handleResultChange(athleteId: string, value: string) {
    if (!selectedEvent || !selectedLink) {
      updateEditRow(athleteId, { result: value })
      return
    }

    const resultNum = parseNumeric(value)
    const pbBenchmark = parseNumeric(existingPB(athleteId))
    const wrBenchmark = currentRecord('current_wr_record', 'official_wr')

    const suggestedPB = isImprovement(resultNum, pbBenchmark, selectedEvent.sport)
    const suggestedWR = isImprovement(resultNum, wrBenchmark, selectedEvent.sport)

    updateEditRow(athleteId, {
      result: value,
      is_pb: pbBenchmark !== null ? suggestedPB : editRows[athleteId]?.is_pb ?? false,
      is_wr: wrBenchmark !== null ? suggestedWR : editRows[athleteId]?.is_wr ?? false,
    })
  }

  function computePrize(finishPosition: string, isWr: boolean) {
    if (!selectedLink) return null
    const position = parseInt(finishPosition, 10)
    let total = 0
    if (position >= 1 && position <= 6) {
      total += selectedLink[PRIZE_FIELDS[position - 1]] ?? 0
    }
    if (isWr) {
      total += selectedLink.prize_wr ?? 0
    }
    return total > 0 ? total : null
  }

  async function handleSaveResults() {
    if (!selectedHeatId) return
    setSaving(true)
    setSaveError(null)

    const updates = Object.entries(editRows).map(([athleteId, row]) => {
      const prize = computePrize(row.finish_position, row.is_wr)
      return supabase
        .from('athlete_heats')
        .update({
          result: row.result || null,
          finish_position: row.finish_position || null,
          is_pb: row.is_pb,
          is_wr: row.is_wr,
          prize_awarded: prize,
        })
        .eq('heat_id', selectedHeatId)
        .eq('athlete_id', athleteId)
    })

    const results = await Promise.all(updates)
    const firstError = results.find((r) => r.error)?.error

    if (firstError) {
      setSaveError(firstError.message)
      setSaving(false)
      return
    }

    setAthleteHeats((prev) =>
      prev.map((ah) => {
        if (ah.heat_id !== selectedHeatId) return ah
        const edit = editRows[ah.athlete_id]
        if (!edit) return ah
        return {
          ...ah,
          result: edit.result || null,
          finish_position: edit.finish_position || null,
          is_pb: edit.is_pb,
          is_wr: edit.is_wr,
          prize_awarded: computePrize(edit.finish_position, edit.is_wr),
        }
      })
    )

    setSaving(false)
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Games / Competitions" title="Results Entry" />
        <p className="state-message">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Results Entry"
        title="Results Entry"
        description="Select a game to see its heats in order of play, update status live, and enter results as they come in."
      />

      <div className="results-page-body">
        {error && <p className="state-message error">{error}</p>}
        {saveError && <p className="state-message error">Save failed: {saveError}</p>}

        <div className="results-grid">
          <div className="heat-picker-panel">
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
                  <div className="heat-list">
                    {(heatsByGame[game.game_id] ?? []).map((heat) => {
                      const link = linkByGeListId[heat.ge_list_id]
                      const evt = link ? eventById[link.event_id] : null
                      return (
                        <button
                          key={heat.heat_id}
                          className={
                            'heat-row' + (selectedHeatId === heat.heat_id ? ' heat-row-active' : '')
                          }
                          onClick={() => setSelectedHeatId(heat.heat_id)}
                        >
                          <div className="heat-row-top">
                            <span className="heat-row-title">
                              Heat {heatIndexWithinEvent(heat)} · {evt?.event_name ?? '—'}
                            </span>
                            <span
                              className={`status-badge status-${(heat.heat_status ?? '').toLowerCase()}`}
                            >
                              {heat.heat_status}
                            </span>
                          </div>
                          <div className="heat-row-sub">
                            {timeAgoLabel(heat.date) &&
                              new Date(heat.date as string).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            {heat.start_time && ` · ${heat.start_time.slice(0, 5)}`}
                            {heat.end_time && ` – ${heat.end_time.slice(0, 5)}`}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="heat-detail-panel">
            {!selectedHeat && (
              <p className="state-message">Select a heat on the left to enter its results.</p>
            )}

            {selectedHeat && selectedEvent && (
              <>
                <div className="detail-header">
                  <div>
                    <h2>Heat {heatIndexWithinEvent(selectedHeat)}</h2>
                    <p className="card-subtitle">
                      {selectedGame?.game_name} · {selectedEvent.event_name}
                    </p>
                  </div>
                  <div className="detail-header-actions">
                    <span
                      className={`status-badge status-${(selectedHeat.heat_status ?? '').toLowerCase()}`}
                    >
                      {selectedHeat.heat_status}
                    </span>
                    <button className="btn-primary" onClick={handleSaveResults} disabled={saving}>
                      {saving ? 'Saving…' : 'Save Results'}
                    </button>
                  </div>
                </div>

                <div className="info-grid">
                  <div>
                    <div className="field-label">Date</div>
                    <div className="info-value">
                      {selectedHeat.date &&
                        new Date(selectedHeat.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Start – End</div>
                    <div className="info-value">
                      {selectedHeat.start_time?.slice(0, 5)} – {selectedHeat.end_time?.slice(0, 5)}
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Current World Record</div>
                    <div className="info-value">
                      {formatWithUnit(
                        currentRecord('current_wr_record', 'official_wr'),
                        selectedEvent.sport
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Enhanced World Record</div>
                    <div className="info-value">
                      {formatWithUnit(
                        currentRecord('current_enhanced_record', 'enhanced_wr'),
                        selectedEvent.sport
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Athletes</div>
                    <div className="info-value">{heatAthleteRows.length}</div>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Lane</th>
                        <th>Athlete</th>
                        <th>Existing PB</th>
                        <th>Result</th>
                        <th>Position</th>
                        <th>PB</th>
                        <th>WR</th>
                        <th>Prize Awarded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {heatAthleteRows.map((row) => {
                        const athlete = athletes.find((a) => a.athlete_id === row.athlete_id)
                        const edit = editRows[row.athlete_id]
                        if (!edit) return null
                        const prize = computePrize(edit.finish_position, edit.is_wr)
                        return (
                          <tr key={row.athlete_id}>
                            <td>{row.lane_no ?? '—'}</td>
                            <td>
                              <div className="athlete-cell">
                                <div className="avatar" />
                                <span>{athlete?.display_name ?? row.athlete_id}</span>
                              </div>
                            </td>
                            <td className="muted">{existingPB(row.athlete_id) ?? '—'}</td>
                            <td>
                              <input
                                className="cell-input"
                                value={edit.result}
                                onChange={(e) =>
                                  handleResultChange(row.athlete_id, e.target.value)
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="cell-input cell-input-narrow"
                                value={edit.finish_position}
                                onChange={(e) =>
                                  updateEditRow(row.athlete_id, {
                                    finish_position: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={'toggle-square' + (edit.is_pb ? ' toggle-square-on' : '')}
                                onClick={() =>
                                  updateEditRow(row.athlete_id, { is_pb: !edit.is_pb })
                                }
                                aria-pressed={edit.is_pb}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={'toggle-square' + (edit.is_wr ? ' toggle-square-on' : '')}
                                onClick={() =>
                                  updateEditRow(row.athlete_id, { is_wr: !edit.is_wr })
                                }
                                aria-pressed={edit.is_wr}
                              />
                            </td>
                            <td>
                              <input
                                className="cell-input"
                                value={formatMoney(prize)}
                                readOnly
                                placeholder="$ —"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {heatAthleteRows.length === 0 && (
                    <p className="state-message">No athletes assigned to this heat yet.</p>
                  )}
                </div>

                <p className="table-footnote">
                  <strong>PB</strong> auto-flagged against the athlete's existing personal best —
                  click a PB or WR box to confirm or clear it. Prize Awarded follows Position, not
                  lane.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
