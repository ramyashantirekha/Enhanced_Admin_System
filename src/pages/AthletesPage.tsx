import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './AthletesPage.css'

type Athlete = {
  athlete_id: string
  display_name: string
  sport: string | null
  country_code: string | null
  enhanced_flag: string | null
  profile_image_url: string | null
}

const PAGE_SIZE = 6

const STATUS_OPTIONS = [
  { code: 'E', label: 'Enhanced' },
  { code: 'NE', label: 'Not Enhanced' },
  { code: 'U', label: 'Undeclared' },
]

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusLabel(code: string | null) {
  const match = STATUS_OPTIONS.find((s) => s.code === code)
  return match ? match.label.toUpperCase() : 'UNDECLARED'
}

function statusClass(code: string | null) {
  if (code === 'E') return 'status-enhanced'
  if (code === 'NE') return 'status-not-enhanced'
  return 'status-undeclared'
}

export default function AthletesPage() {
  const navigate = useNavigate()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sportFilter, setSportFilter] = useState('')
  const [countryFilter, setCountryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    async function fetchAthletes() {
      const { data, error } = await supabase
        .from('athletes')
        .select('athlete_id, display_name, sport, country_code, enhanced_flag, profile_image_url')
        .order('display_name', { ascending: true })

      if (error) {
        setError(error.message)
      } else {
        setAthletes(data ?? [])
      }
      setLoading(false)
    }

    fetchAthletes()
  }, [])

  const sportOptions = useMemo(() => {
    const values = new Set(
      athletes.map((a) => a.sport).filter((s): s is string => Boolean(s))
    )
    return Array.from(values).sort()
  }, [athletes])

  const countryOptions = useMemo(() => {
    const values = new Set(
      athletes.map((a) => a.country_code).filter((c): c is string => Boolean(c))
    )
    return Array.from(values).sort()
  }, [athletes])

  const filtered = useMemo(() => {
    return athletes.filter((a) => {
      if (sportFilter && a.sport !== sportFilter) return false
      if (countryFilter && a.country_code !== countryFilter) return false
      if (statusFilter && a.enhanced_flag !== statusFilter) return false
      return true
    })
  }, [athletes, sportFilter, countryFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [sportFilter, countryFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(page * PAGE_SIZE, filtered.length)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <PageHeader
        breadcrumb="Athletes"
        title="Athletes"
        description="Manage the athlete roster and profile content shown on the public app."
        action={<button onClick={() => navigate('/athletes/new')}>+ New Athlete</button>}
      />

      <div className="athletes-page-body">
        <div className="filters-row">
          <select
            className="filter-select"
            value={sportFilter}
            onChange={(e) => setSportFilter(e.target.value)}
          >
            <option value="">Sport</option>
            {sportOptions.map((s) => (
              <option key={s} value={s}>
                {toTitleCase(s)}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="">Country</option>
            {countryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Enhanced status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="state-message">Loading athletes…</p>}
        {error && <p className="state-message error">{error}</p>}

        {!loading && !error && (
          <>
            <div className="table-wrap">
              <table className="athletes-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Sport</th>
                    <th>Country</th>
                    <th>Enhanced Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((athlete) => (
                    <tr key={athlete.athlete_id}>
                      <td>
                        <div className="athlete-name-cell">
                          <div className="avatar">
                            {athlete.profile_image_url && (
                              <img
                                src={athlete.profile_image_url}
                                alt=""
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            )}
                          </div>
                          <span className="athlete-name">{athlete.display_name}</span>
                        </div>
                      </td>
                      <td className="muted">
                        {athlete.sport ? toTitleCase(athlete.sport) : '—'}
                      </td>
                      <td className="muted">{athlete.country_code ?? '—'}</td>
                      <td>
                        <span className={`status-badge ${statusClass(athlete.enhanced_flag)}`}>
                          {statusLabel(athlete.enhanced_flag)}
                        </span>
                      </td>
                      <td className="row-actions">
                        <div className="action-cell-inner">
                          <button
                            className="btn-link"
                            onClick={() => navigate(`/athletes/edit/${athlete.athlete_id}`)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <p className="state-message">No athletes match these filters.</p>
              )}
            </div>

            <div className="pagination-row">
              <span className="pagination-summary">
                {filtered.length === 0
                  ? 'Showing 0 athletes'
                  : `Showing ${pageStart}–${pageEnd} of ${filtered.length} athletes`}
              </span>
              <div className="pagination-buttons">
                <button
                  className="btn-secondary"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
