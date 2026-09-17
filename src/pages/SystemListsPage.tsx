import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './SystemListsPage.css'

type DomainRow = {
  domain_name: string
  domain_value: string
  description: string
  sort_order: number
}

// Only these domain groups are shown, in this exact order, with clean
// display labels instead of the raw domain_name stored in the DB.
// "key" is matched case-insensitively against the real domain_name column
// (e.g. the DB stores "athlete_enha" for what should read as
// "Athlete Enhanced Status").
const ALLOWED_DOMAINS: { key: string; label: string }[] = [
  { key: 'GAME_STATUS', label: 'Game Status' },
  { key: 'GAME_TYPE', label: 'Game Type' },
  { key: 'EVENT_CATEGORY', label: 'Event Category' },
  { key: 'GENDER', label: 'Gender' },
  { key: 'HEAT_STATUS', label: 'Heat Status' },
  { key: 'athlete_enha', label: 'Athlete Enhanced Status' },
]

function formatValue(value: string): string {
  return value.replace(/_/g, ' ')
}

export default function SystemListsPage() {
  const [rows, setRows] = useState<DomainRow[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    fetchDomains()
  }, [])

  async function fetchDomains() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('eg_domains')
      .select('domain_name, domain_value, description, sort_order')

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setRows(data ?? [])
    if (!selectedKey) {
      setSelectedKey(ALLOWED_DOMAINS[0].key)
    }
    setLoading(false)
  }

  // Restrict the left panel to only the allow-listed groups that actually
  // have data, keeping the fixed display order above (not DB order).
  const visibleDomains = useMemo(() => {
    const present = new Set(rows.map((r) => r.domain_name.toUpperCase()))
    return ALLOWED_DOMAINS.filter((d) => present.has(d.key.toUpperCase()))
  }, [rows])

  const domainRows = useMemo(() => {
    if (!selectedKey) return []
    return rows
      .filter((r) => r.domain_name.toUpperCase() === selectedKey.toUpperCase())
      .sort((a, b) => a.sort_order - b.sort_order)
  }, [rows, selectedKey])

  async function persistSwap(a: DomainRow, b: DomainRow) {
    setError(null)

    const { error: err1 } = await supabase
      .from('eg_domains')
      .update({ sort_order: b.sort_order })
      .eq('domain_name', a.domain_name)
      .eq('domain_value', a.domain_value)
    if (err1) {
      setError(err1.message)
      return false
    }

    const { error: err2 } = await supabase
      .from('eg_domains')
      .update({ sort_order: a.sort_order })
      .eq('domain_name', b.domain_name)
      .eq('domain_value', b.domain_value)
    if (err2) {
      setError(err2.message)
      return false
    }

    return true
  }

  async function handleMoveUp(index: number) {
    if (index === 0 || reordering) return
    setReordering(true)
    const current = domainRows[index]
    const above = domainRows[index - 1]
    const ok = await persistSwap(current, above)
    if (ok) {
      setRows((prev) =>
        prev.map((r) => {
          if (r.domain_name === current.domain_name && r.domain_value === current.domain_value) {
            return { ...r, sort_order: above.sort_order }
          }
          if (r.domain_name === above.domain_name && r.domain_value === above.domain_value) {
            return { ...r, sort_order: current.sort_order }
          }
          return r
        })
      )
    }
    setReordering(false)
  }

  async function handleMoveDown(index: number) {
    if (index === domainRows.length - 1 || reordering) return
    setReordering(true)
    const current = domainRows[index]
    const below = domainRows[index + 1]
    const ok = await persistSwap(current, below)
    if (ok) {
      setRows((prev) =>
        prev.map((r) => {
          if (r.domain_name === current.domain_name && r.domain_value === current.domain_value) {
            return { ...r, sort_order: below.sort_order }
          }
          if (r.domain_name === below.domain_name && r.domain_value === below.domain_value) {
            return { ...r, sort_order: current.sort_order }
          }
          return r
        })
      )
    }
    setReordering(false)
  }

  return (
    <div>
      <PageHeader
        breadcrumb="System Lists"
        title="System Lists"
        description="Dropdown values, categories and labels used across the Games App — no developer involvement needed."
      />

      <div className="syslist-page-body">
        {error && <p className="syslist-state-message syslist-state-error">{error}</p>}
        {loading && <p className="syslist-state-message">Loading…</p>}

        {!loading && (
          <div className="syslist-layout">
            <div className="syslist-domains-panel">
              {visibleDomains.map((d) => (
                <button
                  key={d.key}
                  className={'syslist-domain-btn' + (d.key === selectedKey ? ' syslist-domain-btn-active' : '')}
                  onClick={() => setSelectedKey(d.key)}
                >
                  {d.label}
                </button>
              ))}
              {visibleDomains.length === 0 && <p className="syslist-state-message">No lists found.</p>}
            </div>

            <div className="syslist-values-panel">
              <table className="syslist-table">
                <thead>
                  <tr>
                    <th>Value</th>
                    <th>Description</th>
                    <th>Sort</th>
                  </tr>
                </thead>
                <tbody>
                  {domainRows.map((row, idx) => (
                    <tr key={row.domain_value}>
                      <td className="syslist-value-cell">{formatValue(row.domain_value)}</td>
                      <td className="syslist-description-cell">{row.description}</td>
                      <td className="syslist-sort-cell">
                        <button
                          className="syslist-arrow-btn"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0 || reordering}
                          aria-label="Move up"
                        >
                          ▲
                        </button>
                        <span className="syslist-sort-number">{idx + 1}</span>
                        <button
                          className="syslist-arrow-btn"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === domainRows.length - 1 || reordering}
                          aria-label="Move down"
                        >
                          ▼
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {domainRows.length === 0 && (
                <p className="syslist-state-message">No values in this list yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
