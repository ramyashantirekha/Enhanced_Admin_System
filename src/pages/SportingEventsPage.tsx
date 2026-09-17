import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './SportingEventsPage.css'

type EventRow = {
  event_id: number
  event_name: string
  sport: string | null
  event_category: string | null
  official_wr: number | null
}

const TIME_SPORTS = ['SWIMMING', 'TRACK']

function toTitleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatWorldRecord(value: number | null, sport: string | null) {
  if (value === null || value === undefined) return '—'

  if (sport && TIME_SPORTS.includes(sport.toUpperCase())) {
    if (value < 60) {
      return `${value}s`
    }
    const minutes = Math.floor(value / 60)
    const seconds = (value % 60).toFixed(2).padStart(5, '0')
    return `${minutes}:${seconds}`
  }

  return `${value}kg`
}

export default function SportingEventsPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('event_id, event_name, sport, event_category, official_wr')
        .order('event_name', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setEvents(data ?? [])
      }
      setLoading(false)
    }

    fetchEvents()
  }, [])

  return (
    <div>
      <PageHeader
        breadcrumb="Sporting Events"
        title="Events"
        description="The master catalogue of sporting events Enhanced runs competitions on."
        action={<button onClick={() => navigate('/sporting-events/new')}>+ New Event</button>}
      />

      <div className="events-page-body">
        {loading && <p className="state-message">Loading events…</p>}
        {error && <p className="state-message error">{error}</p>}

        {!loading && !error && (
          <div className="table-wrap">
            <table className="events-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Sport</th>
                  <th>Category</th>
                  <th>World Record</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.event_id}>
                    <td className="event-name">{ev.event_name}</td>
                    <td className="muted">{ev.sport ? toTitleCase(ev.sport) : '—'}</td>
                    <td className="muted">
                      {ev.event_category ? toTitleCase(ev.event_category) : '—'}
                    </td>
                    <td className="muted">{formatWorldRecord(ev.official_wr, ev.sport)}</td>
                    <td className="row-actions">
                      <div className="action-cell-inner">
                        <button
                          className="btn-link"
                          onClick={() => navigate(`/sporting-events/edit/${ev.event_id}`)}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {events.length === 0 && (
              <p className="state-message">No events yet. Add your first one to get started.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
