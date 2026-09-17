import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './SystemVariablesPage.css'

type DomainRow = {
  domain_name: string
  domain_value: string
  description: string
}

type EnvRow = {
  env: 'dev' | 'uat' | 'prod'
  domain_name: string
  domain_value: string
  url: string
}

export default function SystemVariablesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [aiFlagRow, setAiFlagRow] = useState<DomainRow | null>(null)
  const [aiOn, setAiOn] = useState(false)
  const [savingFlag, setSavingFlag] = useState(false)

  const [envRows, setEnvRows] = useState<EnvRow[]>([])
  const [savingEnv, setSavingEnv] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('eg_domains')
      .select('domain_name, domain_value, description')
      .or('domain_name.ilike.EG_AI_FLAG,domain_name.ilike.EG_SYSTEM%')

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const rows = data ?? []

    const flagRow = rows.find((r) => r.domain_name.toUpperCase() === 'EG_AI_FLAG') ?? null
    if (flagRow) {
      setAiFlagRow(flagRow)
      setAiOn(flagRow.domain_value.trim().toUpperCase() === 'TRUE')
    }

    const urlRows = rows.filter((r) => r.domain_name.toUpperCase().startsWith('EG_SYSTEM'))
    const buckets: EnvRow[] = []
    urlRows.forEach((r) => {
      const key = r.domain_value.toUpperCase()
      let env: EnvRow['env'] | null = null
      if (key.includes('PROD')) env = 'prod'
      else if (key.includes('UAT')) env = 'uat'
      else if (key.includes('DEV')) env = 'dev'
      if (env) {
        buckets.push({ env, domain_name: r.domain_name, domain_value: r.domain_value, url: r.description })
      }
    })
    const order: EnvRow['env'][] = ['dev', 'uat', 'prod']
    buckets.sort((a, b) => order.indexOf(a.env) - order.indexOf(b.env))
    setEnvRows(buckets)

    setLoading(false)
  }

  async function handleToggleAi() {
    if (!aiFlagRow || savingFlag) return
    const nextOn = !aiOn
    setSavingFlag(true)
    setError(null)

    const { error } = await supabase
      .from('eg_domains')
      .update({ domain_value: nextOn ? 'TRUE' : 'FALSE' })
      .eq('domain_name', aiFlagRow.domain_name)

    if (error) {
      setError(error.message)
      setSavingFlag(false)
      return
    }

    setAiOn(nextOn)
    setAiFlagRow({ ...aiFlagRow, domain_value: nextOn ? 'TRUE' : 'FALSE' })
    setSavingFlag(false)
  }

  function handleUrlChange(env: EnvRow['env'], value: string) {
    setEnvRows((prev) => prev.map((r) => (r.env === env ? { ...r, url: value } : r)))
  }

  async function handleUrlBlur(row: EnvRow) {
    setSavingEnv(row.env)
    setError(null)

    const { error } = await supabase
      .from('eg_domains')
      .update({ description: row.url })
      .eq('domain_name', row.domain_name)
      .eq('domain_value', row.domain_value)

    if (error) {
      setError(error.message)
    }
    setSavingEnv(null)
  }

  const envLabels: Record<EnvRow['env'], string> = { dev: 'Dev', uat: 'UAT', prod: 'Prod' }

  return (
    <div>
      <PageHeader
        breadcrumb="System Variables"
        title="System Variables"
        description="Feature flags and configuration values, kept separate from ordinary dropdown lists."
      />

      <div className="sysvar-page-body">
        {error && <p className="sysvar-state-message sysvar-state-error">{error}</p>}
        {loading && <p className="sysvar-state-message">Loading…</p>}

        {!loading && (
          <div className="sysvar-cards">
            <div className="sysvar-card">
              <h2>AI Concierge</h2>
              <p className="sysvar-card-subtitle">
                EG_AI_FLAG — switches the AI concierge on or off across the app.
              </p>

              <div className="sysvar-toggle-row">
                <button
                  className={'sysvar-toggle' + (aiOn ? ' sysvar-toggle-on' : '')}
                  onClick={handleToggleAi}
                  disabled={savingFlag || !aiFlagRow}
                  role="switch"
                  aria-checked={aiOn}
                >
                  <span className="sysvar-toggle-knob" />
                </button>
                <span className="sysvar-toggle-label">{aiOn ? 'ON' : 'OFF'}</span>
              </div>
            </div>

            <div className="sysvar-card">
              <h2>Environment URLs</h2>
              <p className="sysvar-card-subtitle">EG_SYSTEM_URL — one entry per environment.</p>

              {envRows.map((row) => (
                <div key={row.env} className="sysvar-field-block">
                  <label className="sysvar-field-label">{envLabels[row.env]}</label>
                  <input
                    type="text"
                    className="sysvar-field-input"
                    value={row.url}
                    onChange={(e) => handleUrlChange(row.env, e.target.value)}
                    onBlur={() => handleUrlBlur(row)}
                    placeholder="https://something-here"
                  />
                </div>
              ))}
              {envRows.length === 0 && (
                <p className="sysvar-state-message">No environment URLs configured.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
