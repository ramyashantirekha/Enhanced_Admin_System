import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './SystemAuditPage.css'

type AuditLogRow = {
  id: number
  table_name: string
  record_pk: Record<string, unknown> | null
  record_name: string | null
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string | null
  changed_at: string
  diff: Record<string, { old?: unknown; new?: unknown }> | Record<string, unknown> | null
}

type FlatRow = {
  key: string
  area: string
  areaLabel: string
  record: string
  operation: string
  changedBy: string
  changedAt: string
  field: string
  oldValue: string
  newValue: string
}

const AREA_LABELS: Record<string, string> = {
  events: 'Sporting Events',
  heats: 'Heats & Prizes',
  athlete_heats: 'Results Entry',
  athlete_pbs: 'Personal Bests',
  featured_athletes: 'Featured Athletes',
  athletes: 'Athletes',
  game_events_list: 'Game/Event Links & Prizes',
  games: 'Games',
  eg_domains: 'System Lists',
  event_media: 'Media',
  notifications: 'Notifications',
  countries: 'Countries',
}

function areaLabelFor(tableName: string): string {
  if (AREA_LABELS[tableName]) return AREA_LABELS[tableName]
  return tableName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function recordLabelFor(row: AuditLogRow): string {
  if (row.record_name && row.record_name.trim()) return row.record_name
  if (row.record_pk && typeof row.record_pk === 'object') {
    const parts = Object.values(row.record_pk).map((v) => formatValue(v))
    if (parts.length > 0) return parts.join(' / ')
  }
  return `#${row.id}`
}

function formatDateTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function flattenRow(row: AuditLogRow): FlatRow[] {
  const areaLabel = areaLabelFor(row.table_name)
  const record = recordLabelFor(row)
  const changedBy = row.changed_by && row.changed_by.trim() ? row.changed_by : 'Unknown'
  const changedAt = formatDateTime(row.changed_at)
  const base = {
    area: row.table_name,
    areaLabel,
    record,
    operation: row.operation,
    changedBy,
    changedAt,
  }

  if (row.operation === 'UPDATE' && row.diff && typeof row.diff === 'object') {
    const entries = Object.entries(row.diff as Record<string, { old?: unknown; new?: unknown }>)
    if (entries.length === 0) {
      return [
        {
          ...base,
          key: `${row.id}-none`,
          field: '—',
          oldValue: '—',
          newValue: '—',
        },
      ]
    }
    return entries.map(([field, change]) => ({
      ...base,
      key: `${row.id}-${field}`,
      field,
      oldValue: formatValue(change?.old),
      newValue: formatValue(change?.new),
    }))
  }

  if (row.operation === 'INSERT') {
    return [
      {
        ...base,
        key: `${row.id}-insert`,
        field: '— (new record)',
        oldValue: '—',
        newValue: 'see record',
      },
    ]
  }

  // DELETE
  return [
    {
      ...base,
      key: `${row.id}-delete`,
      field: '— (record removed)',
      oldValue: 'see record',
      newValue: '—',
    },
  ]
}

const ALL = 'all'

export default function SystemAuditPage() {
  const [rawRows, setRawRows] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterArea, setFilterArea] = useState(ALL)
  const [filterRecord, setFilterRecord] = useState(ALL)
  const [filterAction, setFilterAction] = useState(ALL)
  const [filterField, setFilterField] = useState(ALL)

  useEffect(() => {
    fetchAuditLog()
  }, [])

  async function fetchAuditLog() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('audit_log')
      .select('id, table_name, record_pk, record_name, operation, changed_by, changed_at, diff')
      .order('changed_at', { ascending: false })
      .limit(500)

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setRawRows((data ?? []) as AuditLogRow[])
    setLoading(false)
  }

  const flatRows = useMemo(() => rawRows.flatMap(flattenRow), [rawRows])

  const areaOptions = useMemo(() => {
    const map = new Map<string, string>()
    flatRows.forEach((r) => map.set(r.area, r.areaLabel))
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [flatRows])

  const recordOptions = useMemo(() => {
    if (filterArea === ALL) return []
    const set = new Set(
      flatRows.filter((r) => r.area === filterArea).map((r) => r.record)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [flatRows, filterArea])

  const actionOptions = useMemo(() => {
    if (filterArea === ALL) return []
    const set = new Set(
      flatRows
        .filter(
          (r) =>
            r.area === filterArea &&
            (filterRecord === ALL || r.record === filterRecord)
        )
        .map((r) => r.operation)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [flatRows, filterArea, filterRecord])

  const fieldOptions = useMemo(() => {
    if (filterArea === ALL) return []
    const set = new Set(
      flatRows
        .filter(
          (r) =>
            r.area === filterArea &&
            (filterRecord === ALL || r.record === filterRecord) &&
            (filterAction === ALL || r.operation === filterAction)
        )
        .map((r) => r.field)
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [flatRows, filterArea, filterRecord, filterAction])

  const visibleRows = useMemo(() => {
    return flatRows.filter((r) => {
      if (filterArea !== ALL && r.area !== filterArea) return false
      if (filterRecord !== ALL && r.record !== filterRecord) return false
      if (filterAction !== ALL && r.operation !== filterAction) return false
      if (filterField !== ALL && r.field !== filterField) return false
      return true
    })
  }, [flatRows, filterArea, filterRecord, filterAction, filterField])

  function handleAreaChange(value: string) {
    setFilterArea(value)
    setFilterRecord(ALL)
    setFilterAction(ALL)
    setFilterField(ALL)
  }

  function handleRecordChange(value: string) {
    setFilterRecord(value)
    setFilterAction(ALL)
    setFilterField(ALL)
  }

  function handleActionChange(value: string) {
    setFilterAction(value)
    setFilterField(ALL)
  }

  function handleFieldChange(value: string) {
    setFilterField(value)
  }

  function clearFilters() {
    setFilterArea(ALL)
    setFilterRecord(ALL)
    setFilterAction(ALL)
    setFilterField(ALL)
  }

  const hasActiveFilters =
    filterArea !== ALL || filterRecord !== ALL || filterAction !== ALL || filterField !== ALL

  return (
    <div>
      <PageHeader
        breadcrumb="System Audit"
        title="System Audit"
        description="A read-only history of every change made across the Games App."
      />

      <div className="audit-page-body">
        <div className="audit-filters-card">
          <div className="audit-filters-row">
            <div className="audit-filter-group">
              <label className="audit-filter-label">System Area</label>
              <select
                className="audit-filter-select"
                value={filterArea}
                onChange={(e) => handleAreaChange(e.target.value)}
              >
                <option value={ALL}>All Areas</option>
                {areaOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-filter-group">
              <label className="audit-filter-label">Record</label>
              <select
                className="audit-filter-select"
                value={filterRecord}
                onChange={(e) => handleRecordChange(e.target.value)}
                disabled={filterArea === ALL}
              >
                <option value={ALL}>All Records</option>
                {recordOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-filter-group">
              <label className="audit-filter-label">Action</label>
              <select
                className="audit-filter-select"
                value={filterAction}
                onChange={(e) => handleActionChange(e.target.value)}
                disabled={filterRecord === ALL}
              >
                <option value={ALL}>All Actions</option>
                {actionOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0) + opt.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="audit-filter-group">
              <label className="audit-filter-label">Field</label>
              <select
                className="audit-filter-select"
                value={filterField}
                onChange={(e) => handleFieldChange(e.target.value)}
                disabled={filterAction === ALL}
              >
                <option value={ALL}>All Fields</option>
                {fieldOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button className="audit-clear-link" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        {error && <p className="audit-state-message audit-state-error">{error}</p>}
        {loading && <p className="audit-state-message">Loading audit history…</p>}

        {!loading && !error && (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Changed By</th>
                  <th>Date &amp; Time</th>
                  <th>Action</th>
                  <th>System Area</th>
                  <th>Record</th>
                  <th>Field</th>
                  <th>Old Value</th>
                  <th>New Value</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.changedBy}</td>
                    <td className="audit-muted">{row.changedAt}</td>
                    <td>
                      <span
                        className={
                          'audit-action-badge audit-action-' + row.operation.toLowerCase()
                        }
                      >
                        {row.operation.charAt(0) + row.operation.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td>{row.areaLabel}</td>
                    <td className="audit-record-cell">{row.record}</td>
                    <td>{row.field}</td>
                    <td className="audit-muted">{row.oldValue}</td>
                    <td className="audit-muted">{row.newValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleRows.length === 0 && (
              <p className="audit-state-message">No audit records match the selected filters.</p>
            )}
          </div>
        )}

        {!loading && !error && (
          <p className="audit-table-footnote">
            Showing the most recent {rawRows.length} logged change{rawRows.length === 1 ? '' : 's'}.
            "Changed By" shows as Unknown until user-level tracking is added to the app.
          </p>
        )}
      </div>
    </div>
  )
}
