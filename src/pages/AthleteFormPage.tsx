import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './AthleteFormPage.css'

type AthleteRow = {
  athlete_id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
  gender: string | null
  date_of_birth: string | null
  country_code: string | null
  sport: string | null
  bio: string | null
  career_highlights: string | null
  profile_image_url: string | null
  height_cm: string | null
  weight_kg: string | null
  body_fat_pct: string | null
  muscle_mass_kg: string | null
  vo2_max: string | null
  enhanced_flag: string | null
  instagram: string | null
  tiktok: string | null
  x_handle: string | null
  youtube: string | null
  supplementary_information: string | null
}

type EventOption = { event_id: number; event_name: string }

type PersonalBest = {
  event_id: number | ''
  pre_enhanced_pb: string
  enhanced_pb: string
  weightclass_pb: string
  pre_enhanced_pb_date: string
  enhanced_pb_date: string
  isExisting: boolean
}

const STATUS_OPTIONS = [
  { code: 'E', label: 'Enhanced' },
  { code: 'NE', label: 'Not Enhanced' },
  { code: 'U', label: 'Undeclared' },
]

const emptyForm: Omit<AthleteRow, 'athlete_id'> = {
  first_name: '',
  last_name: '',
  display_name: '',
  gender: '',
  date_of_birth: '',
  country_code: '',
  sport: '',
  bio: '',
  career_highlights: '',
  profile_image_url: '',
  height_cm: '',
  weight_kg: '',
  body_fat_pct: '',
  muscle_mass_kg: '',
  vo2_max: '',
  enhanced_flag: 'U',
  instagram: '',
  tiktok: '',
  x_handle: '',
  youtube: '',
  supplementary_information: '',
}

function isoToDisplay(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}
function displayToIso(display: string) {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match
  return `${y}-${m}-${d}`
}

function displayDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function displayMoney(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '$ —'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '$ —'
  return `$${num.toLocaleString('en-US')}`
}

function emptyPersonalBest(): PersonalBest {
  return {
    event_id: '',
    pre_enhanced_pb: '',
    enhanced_pb: '',
    weightclass_pb: '',
    pre_enhanced_pb_date: '',
    enhanced_pb_date: '',
    isExisting: false,
  }
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
    <div className="athlete-rich-text-box">
      <div className="athlete-rich-text-toolbar">
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
        className="athlete-rich-text-area"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export default function AthleteFormPage() {
  const { athleteId } = useParams()
  const isEditing = Boolean(athleteId)
  const navigate = useNavigate()

  const [form, setForm] = useState(emptyForm)
  const [newAthleteId, setNewAthleteId] = useState('')
  const [dobText, setDobText] = useState('')
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sportOptions, setSportOptions] = useState<string[]>([])
  const [countryOptions, setCountryOptions] = useState<string[]>([])

  const [events, setEvents] = useState<EventOption[]>([])
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([])
  const [removedEventIds, setRemovedEventIds] = useState<number[]>([])
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    async function fetchOptions() {
      const { data } = await supabase.from('athletes').select('sport, country_code')
      if (data) {
        setSportOptions(
          Array.from(new Set(data.map((d) => d.sport).filter((s): s is string => Boolean(s)))).sort()
        )
        setCountryOptions(
          Array.from(
            new Set(data.map((d) => d.country_code).filter((c): c is string => Boolean(c)))
          ).sort()
        )
      }
    }
    fetchOptions()

    async function fetchEvents() {
      const { data } = await supabase
        .from('events')
        .select('event_id, event_name')
        .order('event_name', { ascending: true })
      if (data) setEvents(data)
    }
    fetchEvents()
  }, [])

  useEffect(() => {
    if (!isEditing) return

    async function fetchAthlete() {
      const { data, error } = await supabase
        .from('athletes')
        .select('*')
        .eq('athlete_id', athleteId)
        .single()

      if (error) {
        setError(error.message)
      } else if (data) {
        setForm({
          first_name: data.first_name ?? '',
          last_name: data.last_name ?? '',
          display_name: data.display_name ?? '',
          gender: data.gender ?? '',
          date_of_birth: data.date_of_birth ?? '',
          country_code: data.country_code ?? '',
          sport: data.sport ?? '',
          bio: data.bio ?? '',
          career_highlights: data.career_highlights ?? '',
          profile_image_url: data.profile_image_url ?? '',
          height_cm: data.height_cm ?? '',
          weight_kg: data.weight_kg ?? '',
          body_fat_pct: data.body_fat_pct ?? '',
          muscle_mass_kg: data.muscle_mass_kg ?? '',
          vo2_max: data.vo2_max ?? '',
          enhanced_flag: data.enhanced_flag ?? 'U',
          instagram: data.instagram ?? '',
          tiktok: data.tiktok ?? '',
          x_handle: data.x_handle ?? '',
          youtube: data.youtube ?? '',
          supplementary_information: data.supplementary_information ?? '',
        })
        setDobText(isoToDisplay(data.date_of_birth))
      }
      setLoading(false)
    }

    async function fetchPersonalBests() {
      const { data, error } = await supabase
        .from('athlete_pbs')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('event_id', { ascending: true })

      if (!error && data) {
        setPersonalBests(
          data.map((row) => ({
            event_id: row.event_id,
            pre_enhanced_pb: row.pre_enhanced_pb ?? '',
            enhanced_pb: row.enhanced_pb ?? '',
            weightclass_pb: row.weightclass_pb ?? '',
            pre_enhanced_pb_date: row.pre_enhanced_pb_date ?? '',
            enhanced_pb_date: row.enhanced_pb_date ?? '',
            isExisting: true,
          }))
        )
      }
    }

    async function fetchResults() {
      const { data, error } = await supabase
        .from('game_athlete_list_v')
        .select('*')
        .eq('athlete_id', athleteId)

      if (!error && data) {
        // Number heats sequentially within each event, same convention used elsewhere.
        const withHeatNumber = data.map((row) => {
          const siblings = data
            .filter((r) => r.event_id === row.event_id)
            .sort((a, b) => (a.order_no ?? 0) - (b.order_no ?? 0))
          return { ...row, heatNumber: siblings.indexOf(row) + 1 }
        })
        withHeatNumber.sort((a, b) => {
          const eventCompare = (a.event_name ?? '').localeCompare(b.event_name ?? '')
          if (eventCompare !== 0) return eventCompare
          return (a.order_no ?? 0) - (b.order_no ?? 0)
        })
        setResults(withHeatNumber)
      }
    }

    fetchAthlete()
    fetchPersonalBests()
    fetchResults()
  }, [athleteId, isEditing])

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function eventName(id: number | '') {
    if (id === '') return ''
    return events.find((e) => e.event_id === id)?.event_name ?? `Event #${id}`
  }

  function addPersonalBest() {
    setPersonalBests((list) => [...list, emptyPersonalBest()])
  }
  function updatePersonalBest(index: number, field: keyof PersonalBest, value: string) {
    setPersonalBests((list) =>
      list.map((row, i) =>
        i === index
          ? { ...row, [field]: field === 'event_id' ? Number(value) : value }
          : row
      )
    )
  }
  function removePersonalBest(index: number) {
    setPersonalBests((list) => {
      const row = list[index]
      if (row.isExisting && typeof row.event_id === 'number') {
        setRemovedEventIds((ids) => [...ids, row.event_id as number])
      }
      return list.filter((_, i) => i !== index)
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const athleteIdToUse = isEditing ? (athleteId as string) : newAthleteId.trim()

    if (!isEditing && !athleteIdToUse) {
      setError('Athlete ID is required for a new athlete.')
      setSaving(false)
      return
    }

    const payload = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      display_name: form.display_name || null,
      gender: form.gender || null,
      date_of_birth: displayToIso(dobText),
      country_code: form.country_code || null,
      sport: form.sport || null,
      bio: form.bio || null,
      career_highlights: form.career_highlights || null,
      profile_image_url: form.profile_image_url || null,
      height_cm: form.height_cm || null,
      weight_kg: form.weight_kg || null,
      body_fat_pct: form.body_fat_pct || null,
      muscle_mass_kg: form.muscle_mass_kg || null,
      vo2_max: form.vo2_max || null,
      enhanced_flag: form.enhanced_flag || null,
      instagram: form.instagram || null,
      tiktok: form.tiktok || null,
      x_handle: form.x_handle || null,
      youtube: form.youtube || null,
      supplementary_information: form.supplementary_information || null,
    }

    if (isEditing) {
      const { error } = await supabase
        .from('athletes')
        .update(payload)
        .eq('athlete_id', athleteIdToUse)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase
        .from('athletes')
        .insert({ athlete_id: athleteIdToUse, ...payload })
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }

    if (removedEventIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('athlete_pbs')
        .delete()
        .eq('athlete_id', athleteIdToUse)
        .in('event_id', removedEventIds)
      if (deleteError) {
        setError(deleteError.message)
        setSaving(false)
        return
      }
    }

    const rowsToSave = personalBests.filter((pb) => pb.event_id !== '')
    if (rowsToSave.length > 0) {
      const { error: upsertError } = await supabase.from('athlete_pbs').upsert(
        rowsToSave.map((pb) => ({
          athlete_id: athleteIdToUse,
          event_id: pb.event_id,
          pre_enhanced_pb: pb.pre_enhanced_pb || null,
          enhanced_pb: pb.enhanced_pb || null,
          weightclass_pb: pb.weightclass_pb || null,
          pre_enhanced_pb_date: pb.pre_enhanced_pb_date || null,
          enhanced_pb_date: pb.enhanced_pb_date || null,
        })),
        { onConflict: 'athlete_id,event_id' }
      )
      if (upsertError) {
        setError(upsertError.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/athletes')
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Athletes" title="Athletes" />
        <p className="athlete-form-state-message">Loading athlete…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader breadcrumb="Athletes" title="Athletes" />

      <div className="athlete-form-page">
        <div className="athlete-form-toolbar">
          <div className="athlete-form-breadcrumb">
            Athletes / <strong>{isEditing ? 'Edit Profile' : 'New Athlete'}</strong>
          </div>
          <div className="athlete-toolbar-actions">
            <button className="athlete-btn-secondary" onClick={() => navigate('/athletes')}>
              Cancel
            </button>
            <button className="athlete-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <p className="athlete-form-error">{error}</p>}

        <div className="athlete-form-grid">
          {/* LEFT COLUMN */}
          <div className="athlete-column-narrow">
            <div className="athlete-card">
              <h2>Profile Photo</h2>
              <p className="athlete-card-subtitle">
                Stored as an image URL — shown on the public athlete profile.
              </p>
              <div className="athlete-image-dropzone">
                {form.profile_image_url ? (
                  <img
                    src={form.profile_image_url}
                    alt=""
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <span>No photo set</span>
                )}
              </div>
              <label className="athlete-field-label">Image URL</label>
              <input
                type="text"
                className="athlete-field-input"
                value={form.profile_image_url ?? ''}
                onChange={(e) => updateField('profile_image_url', e.target.value)}
              />
            </div>

            <div className="athlete-card">
              <h2>Enhanced Status</h2>
              <p className="athlete-card-subtitle">Controls the badge on the athlete's profile.</p>
              <select
                className="athlete-field-input"
                value={form.enhanced_flag ?? 'U'}
                onChange={(e) => updateField('enhanced_flag', e.target.value)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="athlete-card">
              <h2>Social Handles</h2>
              <label className="athlete-field-label">Instagram</label>
              <input
                type="text"
                className="athlete-field-input"
                placeholder="@handle"
                value={form.instagram ?? ''}
                onChange={(e) => updateField('instagram', e.target.value)}
              />
              <label className="athlete-field-label">TikTok</label>
              <input
                type="text"
                className="athlete-field-input"
                placeholder="@handle"
                value={form.tiktok ?? ''}
                onChange={(e) => updateField('tiktok', e.target.value)}
              />
              <label className="athlete-field-label">X</label>
              <input
                type="text"
                className="athlete-field-input"
                placeholder="@handle"
                value={form.x_handle ?? ''}
                onChange={(e) => updateField('x_handle', e.target.value)}
              />
              <label className="athlete-field-label">YouTube</label>
              <input
                type="text"
                className="athlete-field-input"
                placeholder="Channel URL"
                value={form.youtube ?? ''}
                onChange={(e) => updateField('youtube', e.target.value)}
              />
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="athlete-column-wide">
            <div className="athlete-card">
              <h2>Basic Information</h2>
              <p className="athlete-card-subtitle">Core identity and affiliation fields.</p>

              {!isEditing && (
                <>
                  <label className="athlete-field-label">Athlete ID</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    placeholder="e.g. W-12"
                    value={newAthleteId}
                    onChange={(e) => setNewAthleteId(e.target.value)}
                  />
                </>
              )}

              <div className="athlete-field-row">
                <div>
                  <label className="athlete-field-label">First Name</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.first_name ?? ''}
                    onChange={(e) => updateField('first_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="athlete-field-label">Last Name</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.last_name ?? ''}
                    onChange={(e) => updateField('last_name', e.target.value)}
                  />
                </div>
              </div>

              <div className="athlete-field-row">
                <div>
                  <label className="athlete-field-label">Display Name</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.display_name ?? ''}
                    onChange={(e) => updateField('display_name', e.target.value)}
                  />
                </div>
                <div>
                  <label className="athlete-field-label">Gender</label>
                  <select
                    className="athlete-field-input"
                    value={form.gender ?? ''}
                    onChange={(e) => updateField('gender', e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="M">M</option>
                    <option value="F">F</option>
                  </select>
                </div>
              </div>

              <div className="athlete-field-row">
                <div>
                  <label className="athlete-field-label">Date of Birth</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    placeholder="DD / MM / YYYY"
                    value={dobText}
                    onChange={(e) => setDobText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="athlete-field-label">Country</label>
                  <select
                    className="athlete-field-input"
                    value={form.country_code ?? ''}
                    onChange={(e) => updateField('country_code', e.target.value)}
                  >
                    <option value="">Select</option>
                    {countryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="athlete-field-label">Headline Sport</label>
              <select
                className="athlete-field-input"
                value={form.sport ?? ''}
                onChange={(e) => updateField('sport', e.target.value)}
              >
                <option value="">Select</option>
                {sportOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="athlete-card">
              <h2>Bio & Highlights</h2>
              <label className="athlete-field-label">Bio</label>
              <RichTextField
                value={form.bio ?? ''}
                onChange={(v) => updateField('bio', v)}
              />
              <label className="athlete-field-label">Career Highlights</label>
              <RichTextField
                value={form.career_highlights ?? ''}
                onChange={(v) => updateField('career_highlights', v)}
              />
              <label className="athlete-field-label">Supplementary Information</label>
              <RichTextField
                value={form.supplementary_information ?? ''}
                onChange={(v) => updateField('supplementary_information', v)}
              />
            </div>

            <div className="athlete-card">
              <h2>Physical Stats</h2>
              <div className="athlete-field-row-3">
                <div>
                  <label className="athlete-field-label">Height (cm)</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.height_cm ?? ''}
                    onChange={(e) => updateField('height_cm', e.target.value)}
                  />
                </div>
                <div>
                  <label className="athlete-field-label">Weight (kg)</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.weight_kg ?? ''}
                    onChange={(e) => updateField('weight_kg', e.target.value)}
                  />
                </div>
                <div>
                  <label className="athlete-field-label">Body Fat %</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.body_fat_pct ?? ''}
                    onChange={(e) => updateField('body_fat_pct', e.target.value)}
                  />
                </div>
              </div>
              <div className="athlete-field-row">
                <div>
                  <label className="athlete-field-label">Muscle Mass (kg)</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.muscle_mass_kg ?? ''}
                    onChange={(e) => updateField('muscle_mass_kg', e.target.value)}
                  />
                </div>
                <div>
                  <label className="athlete-field-label">VO2 Max</label>
                  <input
                    type="text"
                    className="athlete-field-input"
                    value={form.vo2_max ?? ''}
                    onChange={(e) => updateField('vo2_max', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="athlete-card">
              <div className="athlete-card-header-row">
                <div>
                  <h2>Personal Bests</h2>
                  <p className="athlete-card-subtitle">Pre- and post-Enhanced personal bests by event.</p>
                </div>
                <button type="button" className="athlete-btn-secondary" onClick={addPersonalBest}>
                  + Add Personal Best
                </button>
              </div>

              {personalBests.length > 0 && (
                <table className="athlete-pb-table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Pre-Enhanced PB</th>
                      <th>Enhanced PB</th>
                      <th>Weight Class</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalBests.map((row, i) => (
                      <tr key={i}>
                        <td>
                          {row.isExisting ? (
                            <span className="athlete-pb-event-name">{eventName(row.event_id)}</span>
                          ) : (
                            <select
                              className="athlete-field-input"
                              value={row.event_id}
                              onChange={(e) =>
                                updatePersonalBest(i, 'event_id', e.target.value)
                              }
                            >
                              <option value="">Select event</option>
                              {events.map((ev) => (
                                <option key={ev.event_id} value={ev.event_id}>
                                  {ev.event_name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          <input
                            className="athlete-field-input"
                            value={row.pre_enhanced_pb}
                            onChange={(e) =>
                              updatePersonalBest(i, 'pre_enhanced_pb', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="athlete-field-input"
                            value={row.enhanced_pb}
                            onChange={(e) =>
                              updatePersonalBest(i, 'enhanced_pb', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="athlete-field-input"
                            value={row.weightclass_pb}
                            onChange={(e) =>
                              updatePersonalBest(i, 'weightclass_pb', e.target.value)
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="athlete-remove-row-btn"
                            onClick={() => removePersonalBest(i)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="athlete-card">
              <h2>Results at Enhanced Events</h2>
              <p className="athlete-card-subtitle">
                Read-only history of this athlete's results across Enhanced events, pulled from
                Results Entry.
              </p>

              {results.length > 0 ? (
                <table className="athlete-pb-table">
                  <thead>
                    <tr>
                      <th>Event / Heat</th>
                      <th>Date</th>
                      <th>Result</th>
                      <th>Position</th>
                      <th>PB</th>
                      <th>WR</th>
                      <th>Prize</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.heat_id}>
                        <td className="athlete-pb-event-name">
                          {r.event_name} · Heat {r.heatNumber}
                        </td>
                        <td>{displayDate(r.date)}</td>
                        <td>{r.result ?? '—'}</td>
                        <td>{r.finish_position ?? '—'}</td>
                        <td>{r.is_pb ? 'Yes' : 'No'}</td>
                        <td>{r.is_wr ? 'Yes' : 'No'}</td>
                        <td>{displayMoney(r.prize_awarded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="athlete-pb-note">
                  {isEditing
                    ? 'No results recorded for this athlete yet.'
                    : 'Save the athlete first — results will appear here once heats are assigned.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
