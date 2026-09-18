import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './EventFormPage.css'

const TIME_SPORTS = ['SWIMMING', 'TRACK']

const GENDER_OPTIONS = [
  { code: 'M', label: 'Men' },
  { code: 'W', label: 'Women' },
]

function toTitleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

// Display a raw numeric world record with its unit suffix, based on sport.
function formatRecordForDisplay(value: number | null, sport: string) {
  if (value === null || value === undefined || value === ('' as any)) return ''
  if (sport && TIME_SPORTS.includes(sport.toUpperCase())) {
    if (value < 60) return `${value}s`
    const minutes = Math.floor(value / 60)
    const seconds = (value % 60).toFixed(2).padStart(5, '0')
    return `${minutes}:${seconds}`
  }
  return `${value}kg`
}

// Parse a typed value like "9.58s", "1:52.98", or "501kg" back to a plain number for storage.
function parseRecordInput(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const minSecMatch = trimmed.match(/^(\d+):(\d+(\.\d+)?)$/)
  if (minSecMatch) {
    const minutes = parseInt(minSecMatch[1], 10)
    const seconds = parseFloat(minSecMatch[2])
    return minutes * 60 + seconds
  }

  const numeric = parseFloat(trimmed.replace(/[^\d.]/g, ''))
  return isNaN(numeric) ? null : numeric
}

function RichTextField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function wrap(before: string, after: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart, selectionEnd } = el
    const selected = value.slice(selectionStart, selectionEnd)
    const next =
      value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = selectionStart + before.length
      el.selectionEnd = selectionEnd + before.length
    })
  }

  return (
    <div className="event-rich-text-box">
      <div className="event-rich-text-toolbar">
        <button type="button" onClick={() => wrap('**', '**')}>
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => wrap('_', '_')}>
          <em>I</em>
        </button>
        <button type="button" onClick={() => wrap('__', '__')}>
          <u>U</u>
        </button>
      </div>
      <textarea
        ref={ref}
        className="event-rich-text-area"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function EventFormPage() {
  const { eventId } = useParams()
  const isEditing = Boolean(eventId)
  const navigate = useNavigate()

  const [eventName, setEventName] = useState('')
  const [sport, setSport] = useState('')
  const [gender, setGender] = useState('')
  const [category, setCategory] = useState('')
  const [wrText, setWrText] = useState('')
  const [enhancedWrText, setEnhancedWrText] = useState('')
  const [recordHolder, setRecordHolder] = useState('')
  const [yearSet, setYearSet] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const [sportOptions, setSportOptions] = useState<string[]>([])
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOptions() {
      const { data } = await supabase.from('events').select('sport, event_category')
      if (data) {
        setSportOptions(
          Array.from(new Set(data.map((d) => d.sport).filter((s): s is string => Boolean(s)))).sort()
        )
        setCategoryOptions(
          Array.from(
            new Set(
              data.map((d) => d.event_category).filter((c): c is string => Boolean(c))
            )
          ).sort()
        )
      }
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    if (!isEditing) return

    async function fetchEvent() {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_id', eventId)
        .single()

      if (error) {
        setError(error.message)
      } else if (data) {
        setEventName(data.event_name ?? '')
        setSport(data.sport ?? '')
        setGender(data.gender ?? '')
        setCategory(data.event_category ?? '')
        setWrText(formatRecordForDisplay(data.official_wr, data.sport ?? ''))
        setEnhancedWrText(formatRecordForDisplay(data.enhanced_wr, data.sport ?? ''))
        setRecordHolder(data.official_wr_holder ?? '')
        setYearSet(data.official_wr_year ? String(data.official_wr_year) : '')
        setDescription(data.description ?? '')
        setRules(data.rules ?? '')
        setImageUrl(data.event_image_url ?? '')
      }
      setLoading(false)
    }

    fetchEvent()
  }, [eventId, isEditing])

  async function handleSave() {
    setSaving(true)
    setError(null)

    const payload = {
      event_name: eventName || null,
      sport: sport || null,
      gender: gender || null,
      event_category: category || null,
      official_wr: parseRecordInput(wrText),
      enhanced_wr: parseRecordInput(enhancedWrText),
      official_wr_holder: recordHolder || null,
      official_wr_year: yearSet ? parseInt(yearSet, 10) : null,
      description: description || null,
      rules: rules || null,
      event_image_url: imageUrl || null,
    }

    if (isEditing) {
      const { error } = await supabase
        .from('events')
        .update(payload)
        .eq('event_id', eventId)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('events').insert(payload)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/sporting-events')
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Sporting Events" title="Events" />
        <p className="event-form-state-message">Loading event…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader breadcrumb="Sporting Events" title="Events" />

      <div className="event-form-page">
        <div className="event-form-toolbar">
          <div className="event-form-breadcrumb">
            Events / <strong>{isEditing ? 'Edit Event' : 'New Event'}</strong>
          </div>
          <div className="event-toolbar-actions">
            <button className="event-btn-secondary" onClick={() => navigate('/sporting-events')}>
              Cancel
            </button>
            <button className="event-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <p className="event-form-error">{error}</p>}

        <div className="event-form-grid">
          <div className="event-card">
            <h2>Event Image</h2>
            <p className="event-card-subtitle">
              Stored as an image URL — shown on the public event listing and detail page.
            </p>
            <div className="event-image-dropzone">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <span>Image preview</span>
              )}
            </div>
            <label className="event-field-label">Image URL</label>
            <input
              type="text"
              className="event-field-input"
              placeholder="https://cdn.enhanced.com/events/..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>

          <div className="event-card">
            <h2>Event Details</h2>
            <p className="event-card-subtitle">Catalogue entry, rules and world record data.</p>

            <label className="event-field-label">Event Name</label>
            <input
              type="text"
              className="event-field-input"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />

            <div className="event-field-row-3">
              <div>
                <label className="event-field-label">Sport</label>
                <select
                  className="event-field-input"
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                >
                  <option value="">Select</option>
                  {sportOptions.map((s) => (
                    <option key={s} value={s}>
                      {toTitleCase(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="event-field-label">Gender</label>
                <select
                  className="event-field-input"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                >
                  <option value="">Select</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="event-field-label">Category</label>
                <select
                  className="event-field-input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Select</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {toTitleCase(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="event-field-row-4">
              <div>
                <label className="event-field-label">Current World Record</label>
                <input
                  type="text"
                  className="event-field-input"
                  value={wrText}
                  onChange={(e) => setWrText(e.target.value)}
                />
              </div>
              <div>
                <label className="event-field-label">Enhanced World Record</label>
                <input
                  type="text"
                  className="event-field-input"
                  value={enhancedWrText}
                  onChange={(e) => setEnhancedWrText(e.target.value)}
                />
              </div>
              <div>
                <label className="event-field-label">Record Holder</label>
                <input
                  type="text"
                  className="event-field-input"
                  value={recordHolder}
                  onChange={(e) => setRecordHolder(e.target.value)}
                />
              </div>
              <div>
                <label className="event-field-label">Year Set</label>
                <input
                  type="text"
                  className="event-field-input"
                  value={yearSet}
                  onChange={(e) => setYearSet(e.target.value)}
                />
              </div>
            </div>

            <label className="event-field-label">World Record Text</label>
            <RichTextField value={description} onChange={setDescription} />

            <label className="event-field-label">Rules</label>
            <RichTextField value={rules} onChange={setRules} />
          </div>
        </div>
      </div>
    </div>
  )
}
