import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './CountryFormPage.css'

export default function CountryFormPage() {
  const { countryCode } = useParams()
  const isEditing = Boolean(countryCode)
  const navigate = useNavigate()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [flagUrl, setFlagUrl] = useState('')
  const [flagFailed, setFlagFailed] = useState(false)

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing) return

    async function fetchCountry() {
      const { data, error } = await supabase
        .from('countries')
        .select('country_code, country_name, flag_url')
        .eq('country_code', countryCode)
        .single()

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setCode(data.country_code ?? '')
      setName(data.country_name ?? '')
      setFlagUrl(data.flag_url ?? '')
      setLoading(false)
    }

    fetchCountry()
  }, [countryCode, isEditing])

  async function handleSave() {
    setError(null)

    if (!code.trim()) {
      setError('Please enter a country code.')
      return
    }
    if (!name.trim()) {
      setError('Please enter a country name.')
      return
    }

    setSaving(true)

    const payload = {
      country_code: code.trim(),
      country_name: name.trim(),
      flag_url: flagUrl.trim() || null,
    }

    if (isEditing) {
      const { error } = await supabase
        .from('countries')
        .update(payload)
        .eq('country_code', countryCode)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from('countries').insert(payload)
      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    navigate('/countries')
  }

  if (loading) {
    return (
      <div>
        <PageHeader breadcrumb="Countries" title="Countries" />
        <p className="country-state-message">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader breadcrumb="Countries" title="Countries" />

      <div className="country-form-page">
        <div className="country-form-toolbar">
          <div className="country-form-breadcrumb">
            Countries / <strong>{isEditing ? 'Edit Country' : 'Add Country'}</strong>
          </div>
          <div className="country-toolbar-actions">
            <button className="country-btn-secondary" onClick={() => navigate('/countries')}>
              Cancel
            </button>
            <button className="country-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {error && <p className="country-form-error">{error}</p>}

        <div className="country-form-grid">
          <div className="country-card">
            <h2>Flag</h2>
            <p className="country-card-subtitle">
              Stored as an image URL — shown next to the country wherever it appears in lists and filters.
            </p>

            <div className="country-flag-preview">
              {flagUrl && !flagFailed ? (
                <img
                  src={flagUrl}
                  alt="Flag preview"
                  className="country-flag-preview-img"
                  onError={() => setFlagFailed(true)}
                  onLoad={() => setFlagFailed(false)}
                />
              ) : flagUrl ? (
                <span className="country-flag-preview-text">Flag preview</span>
              ) : (
                <span className="country-flag-preview-text">No flag set</span>
              )}
            </div>

            <label className="country-field-label">Flag Image URL</label>
            <input
              type="text"
              className="country-field-input"
              value={flagUrl}
              onChange={(e) => {
                setFlagUrl(e.target.value)
                setFlagFailed(false)
              }}
              placeholder="https://cdn.enhanced.com/flags/us..."
            />
          </div>

          <div className="country-card">
            <h2>Country Details</h2>
            <p className="country-card-subtitle">Reference entry used across athlete profiles and filters.</p>

            <label className="country-field-label">Code</label>
            <input
              type="text"
              className="country-field-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <label className="country-field-label" style={{ marginTop: 16 }}>
              Country Name
            </label>
            <input
              type="text"
              className="country-field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
