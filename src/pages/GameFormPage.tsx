import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './GameFormPage.css'

type GameForm = {
  game_id: string
  game_name: string
  game_type: string
  game_status: string
  start_date: string
  end_date: string
  ticketed_flag: string
  game_description: string
  game_image_url: string
}

const GAME_TYPES = [
  { code: 'G1', label: 'Enhanced Games Event' },
  { code: 'G2', label: 'Breakers Event' },
]
const STATUSES = ['DRAFT', 'SCHEDULED', 'UPCOMING', 'LIVE', 'COMPLETED', 'ARCHIVED']

const emptyForm: GameForm = {
  game_id: '',
  game_name: '',
  game_type: GAME_TYPES[0].code,
  game_status: STATUSES[0],
  start_date: '',
  end_date: '',
  ticketed_flag: 'N',
  game_description: '',
  game_image_url: '',
}

// yyyy-mm-dd (input[type=date] / Postgres) <-> dd/mm/yyyy (what we type)
function isoToDisplay(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}
function displayToIso(display: string) {
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ''
  const [, d, m, y] = match
  return `${y}-${m}-${d}`
}

export default function GameFormPage() {
  const { gameId } = useParams()
  const isEditing = Boolean(gameId)
  const navigate = useNavigate()
  const descriptionRef = useRef<HTMLTextAreaElement>(null)

  const [form, setForm] = useState<GameForm>(emptyForm)
  const [startDateText, setStartDateText] = useState('')
  const [endDateText, setEndDateText] = useState('')
  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing) return

    async function fetchGame() {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('game_id', gameId)
        .single()

      if (error) {
        setError(error.message)
      } else if (data) {
        setForm({
          game_id: data.game_id ?? '',
          game_name: data.game_name ?? '',
          game_type: data.game_type ?? GAME_TYPES[0].code,
          game_status: data.game_status ?? STATUSES[0],
          start_date: data.start_date ?? '',
          end_date: data.end_date ?? '',
          ticketed_flag: data.ticketed_flag ?? 'N',
          game_description: data.game_description ?? '',
          game_image_url: data.game_image_url ?? '',
        })
        setStartDateText(isoToDisplay(data.start_date ?? ''))
        setEndDateText(isoToDisplay(data.end_date ?? ''))
      }
      setLoading(false)
    }

    fetchGame()
  }, [gameId, isEditing])

  function updateField<K extends keyof GameForm>(key: K, value: GameForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function wrapSelection(before: string, after: string) {
    const el = descriptionRef.current
    if (!el) return
    const { selectionStart, selectionEnd, value } = el
    const selected = value.slice(selectionStart, selectionEnd)
    const next =
      value.slice(0, selectionStart) +
      before +
      selected +
      after +
      value.slice(selectionEnd)
    updateField('game_description', next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = selectionStart + before.length
      el.selectionEnd = selectionEnd + before.length
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const payload = {
      game_name: form.game_name,
      game_type: form.game_type,
      game_status: form.game_status,
      start_date: displayToIso(startDateText) || null,
      end_date: displayToIso(endDateText) || null,
      ticketed_flag: form.ticketed_flag,
      game_description: form.game_description || null,
      game_image_url: form.game_image_url || null,
    }

    if (isEditing) {
      const { error } = await supabase
        .from('games')
        .update(payload)
        .eq('game_id', gameId)

      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    } else {
      if (!form.game_id.trim()) {
        setError('Game ID is required for a new game.')
        setSaving(false)
        return
      }
      const { error } = await supabase
        .from('games')
        .insert({ game_id: form.game_id.trim(), ...payload })

      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/games')
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Games / Competitions" title="Games" />
        <p className="game-form-state-message">Loading game…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader breadcrumb="Games / Competitions" title="Games" />

      <div className="game-form-page">
        <div className="game-form-toolbar">
          <div className="game-form-breadcrumb">
            Games / <strong>{isEditing ? 'Edit Game' : 'New Game'}</strong>
          </div>
          <div className="game-toolbar-actions">
            <button className="game-btn-secondary" onClick={() => navigate('/games')}>
              Cancel
            </button>
            <button className="game-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <p className="game-form-error">{error}</p>}

        <div className="game-form-grid">
          <div className="game-card">
            <h2>Game Image</h2>
            <p className="game-card-subtitle">
              Stored as an image URL — shown on the public games listing and event page.
            </p>

            <div className="game-image-dropzone">
              {form.game_image_url ? (
                <img
                  src={form.game_image_url}
                  alt=""
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <span>Image preview</span>
              )}
            </div>

            <label className="game-field-label">Image URL</label>
            <input
              type="text"
              className="game-field-input"
              placeholder="https://cdn.enhanced.com/games/..."
              value={form.game_image_url}
              onChange={(e) => updateField('game_image_url', e.target.value)}
            />
          </div>

          <div className="game-card">
            <h2>Game Details</h2>
            <p className="game-card-subtitle">Core competition record.</p>

            {!isEditing && (
              <>
                <label className="game-field-label">Game ID</label>
                <input
                  type="text"
                  className="game-field-input"
                  placeholder="e.g. WB1"
                  value={form.game_id}
                  onChange={(e) => updateField('game_id', e.target.value)}
                />
              </>
            )}

            <label className="game-field-label">Game Name</label>
            <input
              type="text"
              className="game-field-input"
              value={form.game_name}
              onChange={(e) => updateField('game_name', e.target.value)}
            />

            <div className="game-field-row">
              <div>
                <label className="game-field-label">Game Type</label>
                <select
                  className="game-field-input"
                  value={form.game_type}
                  onChange={(e) => updateField('game_type', e.target.value)}
                >
                  {GAME_TYPES.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="game-field-label">Status</label>
                <select
                  className="game-field-input"
                  value={form.game_status}
                  onChange={(e) => updateField('game_status', e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="game-field-row">
              <div>
                <label className="game-field-label">Start Date</label>
                <input
                  type="text"
                  className="game-field-input"
                  placeholder="DD / MM / YYYY"
                  value={startDateText}
                  onChange={(e) => setStartDateText(e.target.value)}
                />
              </div>
              <div>
                <label className="game-field-label">End Date</label>
                <input
                  type="text"
                  className="game-field-input"
                  placeholder="DD / MM / YYYY"
                  value={endDateText}
                  onChange={(e) => setEndDateText(e.target.value)}
                />
              </div>
            </div>

            <label className="game-field-label">Ticketed Event</label>
            <button
              type="button"
              className={
                'game-toggle-switch' + (form.ticketed_flag === 'Y' ? ' game-toggle-on' : '')
              }
              onClick={() =>
                updateField('ticketed_flag', form.ticketed_flag === 'Y' ? 'N' : 'Y')
              }
              aria-pressed={form.ticketed_flag === 'Y'}
            />

            <label className="game-field-label">Description</label>
            <div className="game-rich-text-box">
              <div className="game-rich-text-toolbar">
                <button type="button" onClick={() => wrapSelection('**', '**')}>
                  <strong>B</strong>
                </button>
                <button type="button" onClick={() => wrapSelection('_', '_')}>
                  <em>I</em>
                </button>
                <button type="button" onClick={() => wrapSelection('__', '__')}>
                  <u>U</u>
                </button>
              </div>
              <textarea
                ref={descriptionRef}
                className="game-rich-text-area"
                value={form.game_description}
                onChange={(e) => updateField('game_description', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
