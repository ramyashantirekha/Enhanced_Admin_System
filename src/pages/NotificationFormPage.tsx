import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './NotificationFormPage.css'

type NotificationRow = {
  id: number
  notification_type: string | null
  title: string | null
  message: string | null
  audience: string | null
  link: string | null
  duration_ms: number | null
  starts_at: string | null
  expires_at: string | null
  status: string | null
  last_published_at: string | null
  last_published_by: string | null
}

const TYPE_LABELS: Record<string, string> = { GNRL: 'General' }
const AUDIENCE_LABELS: Record<string, string> = { GLBL: 'Global' }

// No auth/session tracking yet — hardcoded until real user identity is wired up.
// Once auth is in place, replace this with the logged-in user's id/email
// (e.g. from supabase.auth.getUser() or a session context).
const currentUser = 'Admin'

// Split an ISO timestamp into separate date/time text fields for the form,
// and back again on save.
function splitDateTime(iso: string | null) {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { date: '', time: '' }
  const date = d.toISOString().slice(0, 10)
  const time = d.toISOString().slice(11, 16)
  return { date, time }
}
function joinDateTime(date: string, time: string): string | null {
  if (!date) return null
  return `${date}T${time || '00:00'}:00`
}

export default function NotificationFormPage() {
  const { notificationId } = useParams()
  const isEditing = Boolean(notificationId)
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [notificationType, setNotificationType] = useState('GNRL')
  const [audience, setAudience] = useState('GLBL')
  const [link, setLink] = useState('')
  const [durationMs, setDurationMs] = useState('20000')
  const [startsDate, setStartsDate] = useState('')
  const [startsTime, setStartsTime] = useState('')
  const [expiresDate, setExpiresDate] = useState('')
  const [expiresTime, setExpiresTime] = useState('')
  const [status, setStatus] = useState('DRAFT')
  const [lastPublishedAt, setLastPublishedAt] = useState<string | null>(null)
  const [lastPublishedBy, setLastPublishedBy] = useState<string | null>(null)

  const [typeOptions, setTypeOptions] = useState<string[]>(['GNRL'])
  const [audienceOptions, setAudienceOptions] = useState<string[]>(['GLBL'])

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOptions() {
      const { data } = await supabase.from('notifications').select('notification_type, audience')
      if (data) {
        const types = Array.from(
          new Set(data.map((d) => d.notification_type).filter((t): t is string => Boolean(t)))
        )
        const auds = Array.from(
          new Set(data.map((d) => d.audience).filter((a): a is string => Boolean(a)))
        )
        if (types.length) setTypeOptions(types)
        if (auds.length) setAudienceOptions(auds)
      }
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    if (!isEditing) return

    async function fetchNotification() {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .single()

      if (error) {
        setError(error.message)
      } else if (data) {
        setTitle(data.title ?? '')
        setMessage(data.message ?? '')
        setNotificationType(data.notification_type ?? 'GNRL')
        setAudience(data.audience ?? 'GLBL')
        setLink(data.link ?? '')
        setDurationMs(data.duration_ms != null ? String(data.duration_ms) : '')
        const starts = splitDateTime(data.starts_at)
        const expires = splitDateTime(data.expires_at)
        setStartsDate(starts.date)
        setStartsTime(starts.time)
        setExpiresDate(expires.date)
        setExpiresTime(expires.time)
        setStatus(data.status ?? 'DRAFT')
        setLastPublishedAt(data.last_published_at)
        setLastPublishedBy(data.last_published_by)
      }
      setLoading(false)
    }

    fetchNotification()
  }, [notificationId, isEditing])

  function buildPayload() {
    return {
      title: title || null,
      message: message || null,
      notification_type: notificationType || null,
      audience: audience || null,
      link: link || null,
      duration_ms: durationMs ? parseInt(durationMs, 10) : null,
      starts_at: joinDateTime(startsDate, startsTime),
      expires_at: joinDateTime(expiresDate, expiresTime),
    }
  }

  async function handleSaveDraft() {
    setSaving('draft')
    setError(null)

    const payload = buildPayload()

    if (isEditing) {
      const { error } = await supabase
        .from('notifications')
        .update({ ...payload, updated_by: currentUser })
        .eq('id', notificationId)
      if (error) {
        setError(error.message)
        setSaving(null)
        return
      }
    } else {
      const { error } = await supabase.from('notifications').insert({
        ...payload,
        status: 'DRAFT',
        created_by: currentUser,
        updated_by: currentUser,
      })
      if (error) {
        setError(error.message)
        setSaving(null)
        return
      }
    }

    setSaving(null)
    navigate('/notifications')
  }

  async function handlePublish() {
    setSaving('publish')
    setError(null)

    const payload = buildPayload()
    const publishedBy = 'Admin' // no auth/session tracking yet — see note below
    const publishedAt = new Date().toISOString()

    let targetId = notificationId ? Number(notificationId) : null

    if (isEditing) {
      const { error } = await supabase
        .from('notifications')
        .update({
          ...payload,
          status: 'PUBLISHED',
          last_published_at: publishedAt,
          last_published_by: publishedBy,
          updated_by: currentUser,
        })
        .eq('id', notificationId)
      if (error) {
        setError(error.message)
        setSaving(null)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          ...payload,
          status: 'PUBLISHED',
          last_published_at: publishedAt,
          last_published_by: publishedBy,
          created_by: currentUser,
          updated_by: currentUser,
        })
        .select()
        .single()
      if (error) {
        setError(error.message)
        setSaving(null)
        return
      }
      targetId = data.id
    }

    const { error: logError } = await supabase.from('notification_publish_log').insert({
      notification_id: targetId,
      ...payload,
      published_at: publishedAt,
      published_by: publishedBy,
    })
    if (logError) {
      setError(logError.message)
      setSaving(null)
      return
    }

    setSaving(null)
    navigate('/notifications')
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Notifications" title="Notifications" />
        <p className="state-message">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader breadcrumb="Notifications" title="Notifications" />

      <div className="notif-form-page">
        <div className="notif-form-toolbar">
          <div className="form-breadcrumb">
            Notifications / <strong>{isEditing ? 'Edit Notification' : 'New Draft'}</strong>
          </div>
          <button className="btn-secondary" onClick={() => navigate('/notifications')}>
            Back to Drafts
          </button>
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="notif-form-grid">
          <div className="form-card">
            <div className="card-header-row">
              <div>
                <h2>Notification Details</h2>
                <p className="card-subtitle">
                  A draft can be edited and republished as many times as needed — each Publish
                  sends it immediately and logs a new entry to Publish History.
                </p>
              </div>
              <span className={`status-pill status-${status.toLowerCase()}`}>
                {status === 'PUBLISHED' ? 'Published' : 'Draft'}
              </span>
            </div>

            <label className="field-label">Title</label>
            <input
              type="text"
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="New notification"
            />

            <label className="field-label">Message</label>
            <textarea
              className="field-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter the notification message…"
            />

            <div className="field-row">
              <div>
                <label className="field-label">Type</label>
                <select
                  className="field-input"
                  value={notificationType}
                  onChange={(e) => setNotificationType(e.target.value)}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Audience</label>
                <select
                  className="field-input"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                >
                  {audienceOptions.map((a) => (
                    <option key={a} value={a}>
                      {AUDIENCE_LABELS[a] ?? a}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-row">
              <div>
                <label className="field-label">Link</label>
                <input
                  type="text"
                  className="field-input"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Duration (ms)</label>
                <input
                  type="text"
                  className="field-input"
                  value={durationMs}
                  onChange={(e) => setDurationMs(e.target.value)}
                />
              </div>
            </div>

            <div className="field-row-4">
              <div>
                <label className="field-label">Starts At — Date</label>
                <input
                  type="date"
                  className="field-input"
                  value={startsDate}
                  onChange={(e) => setStartsDate(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Starts At — Time</label>
                <input
                  type="time"
                  className="field-input"
                  value={startsTime}
                  onChange={(e) => setStartsTime(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Expires At — Date</label>
                <input
                  type="date"
                  className="field-input"
                  value={expiresDate}
                  onChange={(e) => setExpiresDate(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Expires At — Time</label>
                <input
                  type="time"
                  className="field-input"
                  value={expiresTime}
                  onChange={(e) => setExpiresTime(e.target.value)}
                />
              </div>
            </div>

            <p className="form-note">
              Scheduling an automatic send at "Starts At" is planned for a later phase — for now,
              Publish sends immediately whenever you click it.
            </p>
          </div>

          <div className="form-card entry-card">
            <h2>Entry</h2>
            <p className="card-subtitle">
              {lastPublishedAt
                ? `Published ${new Date(lastPublishedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })} · ${new Date(lastPublishedAt).toLocaleTimeString('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}${lastPublishedBy ? ` by ${lastPublishedBy}` : ''}`
                : 'Not published yet.'}
            </p>

            <button className="btn-primary" onClick={handlePublish} disabled={saving !== null}>
              {saving === 'publish' ? 'Publishing…' : 'Publish'}
            </button>
            <button className="btn-secondary-full" onClick={handleSaveDraft} disabled={saving !== null}>
              {saving === 'draft' ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
