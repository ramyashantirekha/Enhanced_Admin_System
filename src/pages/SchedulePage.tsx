import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './SchedulePage.css'

type Game = { game_id: string; game_name: string }
type EventRow = { event_id: number; event_name: string }
type GameEventLink = { ge_list_id: number; game_id: string; event_id: number }
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

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
]

// en-GB gives "13 Sept 2026" (day-month-year, no comma) — en-US would give
// "Sept 13, 2026" (month-first) regardless of how the options are ordered.
function formatDateDisplay(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// "13 Sept 2026" -> "2026-09-13". Returns null if it doesn't parse.
function parseDateDisplay(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/)
  if (!match) return null
  const [, dayStr, monthStr, yearStr] = match
  const monthIndex = MONTHS.findIndex((m) => monthStr.toLowerCase().startsWith(m))
  if (monthIndex === -1) return null
  const day = dayStr.padStart(2, '0')
  const month = String(monthIndex + 1).padStart(2, '0')
  return `${yearStr}-${month}-${day}`
}

function formatTimeDisplay(value: string | null) {
  if (!value) return ''
  return value.slice(0, 5)
}

// Accepts "11:00" or "11:00:00", returns "HH:MM:SS" for storage.
function parseTimeDisplay(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const [, h, m] = match
  return `${h.padStart(2, '0')}:${m}:00`
}

export default function SchedulePage() {
  const [games, setGames] = useState<Game[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [links, setLinks] = useState<GameEventLink[]>([])
  const [heats, setHeats] = useState<HeatRow[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  // The heat_id order for the currently selected game, controlled directly
  // by the up/down arrows. Kept separate from heats[].order_no, since that
  // column has duplicate values across different events and can't reliably
  // drive a single cross-event display order on its own.
  const [rowOrder, setRowOrder] = useState<string[]>([])

  useEffect(() => {
    async function fetchAll() {
      const [gamesRes, eventsRes, linksRes, heatsRes] = await Promise.all([
        supabase.from('games').select('game_id, game_name'),
        supabase.from('events').select('event_id, event_name'),
        supabase.from('game_events_list').select('ge_list_id, game_id, event_id'),
        supabase.from('heats').select('*'),
      ])

      const firstError = gamesRes.error || eventsRes.error || linksRes.error || heatsRes.error
      if (firstError) {
        setError(firstError.message)
        setLoading(false)
        return
      }

      setGames(gamesRes.data ?? [])
      setEvents(eventsRes.data ?? [])
      setLinks(linksRes.data ?? [])
      setHeats(heatsRes.data ?? [])

      if (gamesRes.data && gamesRes.data.length > 0) {
        setSelectedGameId(gamesRes.data[0].game_id)
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

  const eventName = (id: number) => events.find((e) => e.event_id === id)?.event_name ?? `Event #${id}`

  const heatIndexWithinEvent = (heat: HeatRow) => {
    const siblings = heats
      .filter((h) => h.ge_list_id === heat.ge_list_id)
      .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
    return siblings.indexOf(heat) + 1
  }

  // Re-initialize rowOrder only when the selected game changes (or data first
  // loads) — NOT on every heats update, so editing a date/time doesn't reset
  // any manual reordering you've already done in this session.
  useEffect(() => {
    if (!selectedGameId || heats.length === 0) {
      setRowOrder([])
      return
    }
    const initial = heats
      .filter((h) => linkByGeListId[h.ge_list_id]?.game_id === selectedGameId)
      .sort((a, b) => {
        const dateCompare = (a.date ?? '').localeCompare(b.date ?? '')
        if (dateCompare !== 0) return dateCompare
        return (a.start_time ?? '').localeCompare(b.start_time ?? '')
      })
      .map((h) => h.heat_id)
    setRowOrder(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGameId, heats.length])

  const scheduleRows = useMemo(() => {
    return rowOrder
      .map((id) => heats.find((h) => h.heat_id === id))
      .filter((h): h is HeatRow => Boolean(h))
  }, [rowOrder, heats])

  async function updateHeatField(heatId: string, field: keyof HeatRow, value: string | null) {
    setHeats((prev) =>
      prev.map((h) => (h.heat_id === heatId ? { ...h, [field]: value } : h))
    )

    const { error } = await supabase
      .from('heats')
      .update({ [field]: value })
      .eq('heat_id', heatId)

    if (error) setSaveError(error.message)
  }

  function swapOrder(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= rowOrder.length) return

    const newOrder = [...rowOrder]
    ;[newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]]
    setRowOrder(newOrder)

    // Best-effort: persist order_no as the row's new position, so the
    // database reflects this session's ordering too. Since order_no isn't
    // unique across events, this is informational rather than load-bearing —
    // the display itself is driven entirely by rowOrder above.
    newOrder.forEach((heatId, i) => {
      supabase
        .from('heats')
        .update({ order_no: i + 1 })
        .eq('heat_id', heatId)
        .then(({ error }) => {
          if (error) setSaveError(error.message)
        })
    })
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Games / Competitions" title="Schedule" />
        <p className="state-message">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Schedule"
        title="Schedule"
        description="Select a game to set the date, start/end time and running order for each of its heats."
      />

      <div className="schedule-page-body">
        {error && <p className="state-message error">{error}</p>}
        {saveError && <p className="state-message error">Save failed: {saveError}</p>}

        <div className="schedule-grid">
          <div className="game-picker-panel">
            {games.map((game) => (
              <button
                key={game.game_id}
                className={
                  'game-picker-row' + (selectedGameId === game.game_id ? ' game-picker-active' : '')
                }
                onClick={() => setSelectedGameId(game.game_id)}
              >
                {game.game_name}
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Heat</th>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Running Order</th>
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((heat, i) => {
                  const link = linkByGeListId[heat.ge_list_id]
                  return (
                    <tr key={heat.heat_id}>
                      <td className="heat-label">
                        Heat {heatIndexWithinEvent(heat)} · {link ? eventName(link.event_id) : '—'}
                      </td>
                      <td>
                        <input
                          type="text"
                          className="field-input field-input-date"
                          defaultValue={formatDateDisplay(heat.date)}
                          onBlur={(e) => {
                            const parsed = parseDateDisplay(e.target.value)
                            if (parsed) updateHeatField(heat.heat_id, 'date', parsed)
                            else e.target.value = formatDateDisplay(heat.date)
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="field-input field-input-narrow"
                          defaultValue={formatTimeDisplay(heat.start_time)}
                          onBlur={(e) => {
                            const parsed = parseTimeDisplay(e.target.value)
                            if (parsed) updateHeatField(heat.heat_id, 'start_time', parsed)
                            else e.target.value = formatTimeDisplay(heat.start_time)
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="field-input field-input-narrow"
                          defaultValue={formatTimeDisplay(heat.end_time)}
                          onBlur={(e) => {
                            const parsed = parseTimeDisplay(e.target.value)
                            if (parsed) updateHeatField(heat.heat_id, 'end_time', parsed)
                            else e.target.value = formatTimeDisplay(heat.end_time)
                          }}
                        />
                      </td>
                      <td>
                        <span
                          className={`status-badge status-${(heat.heat_status ?? '').toLowerCase()}`}
                        >
                          {heat.heat_status}
                        </span>
                      </td>
                      <td className="running-order-cell">
                        <button
                          className="order-arrow"
                          disabled={i === 0}
                          onClick={() => swapOrder(i, 'up')}
                        >
                          ▲
                        </button>
                        <span className="order-number">{i + 1}</span>
                        <button
                          className="order-arrow"
                          disabled={i === scheduleRows.length - 1}
                          onClick={() => swapOrder(i, 'down')}
                        >
                          ▼
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {scheduleRows.length === 0 && (
              <p className="state-message">No heats scheduled for this game yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
