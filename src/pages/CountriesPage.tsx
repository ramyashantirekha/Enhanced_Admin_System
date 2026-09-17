import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './CountriesPage.css'

type CountryRow = {
  country_code: string
  country_name: string
  flag_url: string | null
}

function FlagThumb({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return <span className="country-flag-thumb country-flag-thumb-empty" />
  }

  return (
    <img
      src={url}
      alt=""
      className="country-flag-thumb"
      onError={() => setFailed(true)}
    />
  )
}

export default function CountriesPage() {
  const navigate = useNavigate()

  const [rows, setRows] = useState<CountryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCountries()
  }, [])

  async function fetchCountries() {
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('countries')
      .select('country_code, country_name, flag_url')
      .order('country_name', { ascending: true })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setRows(data ?? [])
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Countries"
        title="Countries"
        description="Reference list of countries athletes are affiliated with."
        action={<button onClick={() => navigate('/countries/new')}>+ Add Country</button>}
      />

      <div className="country-page-body">
        {error && <p className="country-state-message country-state-error">{error}</p>}
        {loading && <p className="country-state-message">Loading…</p>}

        {!loading && (
          <div className="country-table-wrap">
            <table className="country-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Code</th>
                  <th>Country</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.country_code}>
                    <td className="country-flag-cell">
                      <FlagThumb url={row.flag_url} />
                    </td>
                    <td className="country-code-cell">{row.country_code}</td>
                    <td className="country-name-cell">{row.country_name}</td>
                    <td className="country-actions-cell">
                      <button
                        className="country-edit-link"
                        onClick={() => navigate(`/countries/edit/${row.country_code}`)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="country-state-message">No countries yet.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
