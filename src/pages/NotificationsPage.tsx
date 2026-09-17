import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './NotificationsPage.css'

type Notification = {
  id: number
  notification_type: string | null
  title: string | null
  message: string | null
  audience: string | null
  status: string | null
  last_published_at: string | null
}

type PublishLogRow = {
  id: number
  notification_type: string | null
  title: string | null
  message: string | null
  audience: string | null
  published_at: string | null
  published_by: string | null
}

const TYPE_LABELS: Record<string, string> = {
  GNRL: 'General',
}
const AUDIENCE_LABELS: Record<string, string> = {
  GLBL: 'Global',
}

function typeLabel(code: string | null) {
  if (!code) return '—'
  return TYPE_LABELS[code] ?? code
}
function audienceLabel(code: string | null) {
  if (!code) return '—'
  return AUDIENCE_LABELS[code] ?? code
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return '—'
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'drafts' | 'history'>('drafts')

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [publishLog, setPublishLog] = useState<PublishLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    async function fetchAll() {
      const [notifRes, logRes] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, notification_type, title, message, audience, status, last_published_at')
          .order('id', { ascending: false }),
        supabase
          .from('notification_publish_log')
          .select('id, notification_type, title, message, audience, published_at, published_by')
          .order('published_at', { ascending: false }),
      ])

      if (notifRes.error || logRes.error) {
        setError((notifRes.error ?? logRes.error)?.message ?? 'Failed to load')
        setLoading(false)
        return
      }

      setNotifications(notifRes.data ?? [])
      setPublishLog(logRes.data ?? [])
      setLoading(false)
    }

    fetchAll()
  }, [])

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(notifications.map((n) => n.notification_type).filter((t): t is string => Boolean(t)))
    )
  }, [notifications])

  const filteredNotifications = notifications.filter((n) => {
    if (typeFilter && n.notification_type !== typeFilter) return false
    if (statusFilter && n.status !== statusFilter) return false
    return true
  })

  async function handleDelete(id: number) {
    setError(null)
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Notifications"
        title="Notifications"
        description="Prepare notifications in advance, then publish them when ready — every publish is logged to Publish History."
        action={
          tab === 'drafts' ? (
            <button onClick={() => navigate('/notifications/new')}>+ New Draft</button>
          ) : undefined
        }
      />

      <div className="notifications-page-body">
        <div className="tab-row">
          <button
            className={'tab-btn' + (tab === 'drafts' ? ' tab-btn-active' : '')}
            onClick={() => setTab('drafts')}
          >
            Drafts
          </button>
          <button
            className={'tab-btn' + (tab === 'history' ? ' tab-btn-active' : '')}
            onClick={() => setTab('history')}
          >
            Publish History
          </button>
        </div>

        {error && <p className="state-message error">{error}</p>}
        {loading && <p className="state-message">Loading…</p>}

        {!loading && tab === 'drafts' && (
          <>
            <div className="filters-row">
              <select
                className="filter-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>
                    {typeLabel(t)}
                  </option>
                ))}
              </select>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>

            <div className="table-wrap">
              <table className="notifications-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Last Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotifications.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <span className="type-badge">{typeLabel(n.notification_type)}</span>
                      </td>
                      <td className="notif-title">{n.title || 'New notification'}</td>
                      <td className="notif-message">
                        {n.message || <em>Enter the notification message…</em>}
                      </td>
                      <td>
                        <span
                          className={`status-badge status-${(n.status ?? '').toLowerCase()}`}
                        >
                          {n.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="muted">
                        {n.last_published_at ? formatDateTime(n.last_published_at) : '—'}
                      </td>
                      <td className="row-actions">
                        <button
                          className="btn-link"
                          onClick={() => navigate(`/notifications/edit/${n.id}`)}
                        >
                          Edit
                        </button>
                        <span className="remove-x" onClick={() => handleDelete(n.id)}>
                          ×
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredNotifications.length === 0 && (
                <p className="state-message">No notifications match these filters.</p>
              )}
            </div>
          </>
        )}

        {!loading && tab === 'history' && (
          <div className="table-wrap">
            <table className="notifications-table">
              <thead>
                <tr>
                  <th>Published</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Message</th>
                  <th>Audience</th>
                  <th>Published By</th>
                </tr>
              </thead>
              <tbody>
                {publishLog.map((row) => (
                  <tr key={row.id}>
                    <td className="muted">{formatDateTime(row.published_at)}</td>
                    <td>
                      <span className="type-badge">{typeLabel(row.notification_type)}</span>
                    </td>
                    <td className="notif-title">{row.title}</td>
                    <td className="notif-message">{row.message}</td>
                    <td className="muted">{audienceLabel(row.audience)}</td>
                    <td className="muted">{row.published_by ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {publishLog.length === 0 && (
              <p className="state-message">Nothing has been published yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
