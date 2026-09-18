import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './FeaturedAthletesPage.css'

type Game = {
  game_id: string
  game_name: string
}

type FeaturedRow = {
  fa_id: number
  athlete_id: string
  sort_position: number
  display_name: string | null
  sport: string | null
}

type EligibleAthlete = {
  athlete_id: string
  display_name: string | null
  sport: string | null
}

export default function FeaturedAthletesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)

  const [featured, setFeatured] = useState<FeaturedRow[]>([])
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadingFeatured, setLoadingFeatured] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showAddModal, setShowAddModal] = useState(false)
  const [eligibleAthletes, setEligibleAthletes] = useState<EligibleAthlete[]>([])
  const [loadingEligible, setLoadingEligible] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  const selectedGame = games.find((g) => g.game_id === selectedGameId) ?? null

  // Load games for the left panel
  useEffect(() => {
    async function fetchGames() {
      setLoadingGames(true)
      const { data, error } = await supabase
        .from('games')
        .select('game_id, game_name')
        .order('game_name', { ascending: true })

      if (error) {
        setError(error.message)
        setLoadingGames(false)
        return
      }

      setGames(data ?? [])
      if (data && data.length > 0) {
        setSelectedGameId(data[0].game_id)
      }
      setLoadingGames(false)
    }
    fetchGames()
  }, [])

  // Load featured athletes whenever the selected game changes
  useEffect(() => {
    if (!selectedGameId) return
    fetchFeatured(selectedGameId)
  }, [selectedGameId])

  async function fetchFeatured(gameId: string) {
    setLoadingFeatured(true)
    setError(null)

    const { data, error } = await supabase
      .from('featured_athletes')
      .select('fa_id, athlete_id, sort_position, athletes(display_name, sport)')
      .eq('game_id', gameId)
      .order('sort_position', { ascending: true })

    if (error) {
      setError(error.message)
      setLoadingFeatured(false)
      return
    }

    type RawRow = {
      fa_id: number
      athlete_id: string
      sort_position: number
      athletes: { display_name: string | null; sport: string | null } | null
    }

    const rows: FeaturedRow[] = ((data ?? []) as unknown as RawRow[]).map((row) => ({
      fa_id: row.fa_id,
      athlete_id: row.athlete_id,
      sort_position: row.sort_position,
      display_name: row.athletes?.display_name ?? null,
      sport: row.athletes?.sport ?? null,
    }))

    setFeatured(rows)
    setLoadingFeatured(false)
  }

  // --- Reordering -----------------------------------------------------
  // Swaps are done as three SEQUENTIAL, awaited updates (not Promise.all).
  // Running them in parallel can momentarily give two rows the same
  // sort_position, which trips the uq_featured_athletes_game_position
  // unique constraint, and/or causes a Postgres deadlock when two
  // connections lock the same rows in different orders. Parking row A on
  // an unused placeholder position first avoids both problems.

  async function persistSwap(a: FeaturedRow, b: FeaturedRow) {
    setError(null)

    // Step 1: park row A on a value nothing else uses.
    // Must stay positive to satisfy chk_featured_athletes_position, so we
    // use a value well above any realistic list length instead of a
    // negative placeholder.
    const PLACEHOLDER_POSITION = 999999
    const { error: err1 } = await supabase
      .from('featured_athletes')
      .update({ sort_position: PLACEHOLDER_POSITION })
      .eq('fa_id', a.fa_id)
    if (err1) {
      setError(err1.message)
      return false
    }

    // Step 2: move row B into A's old spot
    const { error: err2 } = await supabase
      .from('featured_athletes')
      .update({ sort_position: a.sort_position })
      .eq('fa_id', b.fa_id)
    if (err2) {
      setError(err2.message)
      return false
    }

    // Step 3: move row A into B's old spot
    const { error: err3 } = await supabase
      .from('featured_athletes')
      .update({ sort_position: b.sort_position })
      .eq('fa_id', a.fa_id)
    if (err3) {
      setError(err3.message)
      return false
    }

    return true
  }

  async function handleMoveUp(index: number) {
    if (index === 0 || reordering) return
    setReordering(true)
    const current = featured[index]
    const above = featured[index - 1]
    const ok = await persistSwap(current, above)
    if (ok) {
      const next = [...featured]
      next[index] = { ...above, sort_position: current.sort_position }
      next[index - 1] = { ...current, sort_position: above.sort_position }
      setFeatured(next)
    }
    setReordering(false)
  }

  async function handleMoveDown(index: number) {
    if (index === featured.length - 1 || reordering) return
    setReordering(true)
    const current = featured[index]
    const below = featured[index + 1]
    const ok = await persistSwap(current, below)
    if (ok) {
      const next = [...featured]
      next[index] = { ...below, sort_position: current.sort_position }
      next[index + 1] = { ...current, sort_position: below.sort_position }
      setFeatured(next)
    }
    setReordering(false)
  }

  // --- Remove -----------------------------------------------------------
  // Renumbering after a delete is also done sequentially for the same
  // reason as the swap above — avoids any transient overlap/deadlock risk.

  async function handleRemove(faId: number) {
    setError(null)
    const { error } = await supabase.from('featured_athletes').delete().eq('fa_id', faId)
    if (error) {
      setError(error.message)
      return
    }

    const remaining = featured.filter((f) => f.fa_id !== faId)
    const renumbered = remaining.map((f, idx) => ({ ...f, sort_position: idx + 1 }))
    setFeatured(renumbered)

    for (const f of renumbered) {
      const { error: updateErr } = await supabase
        .from('featured_athletes')
        .update({ sort_position: f.sort_position })
        .eq('fa_id', f.fa_id)
      if (updateErr) {
        setError(updateErr.message)
        return
      }
    }
  }

  // --- Add Athlete modal -------------------------------------------------

  async function openAddModal() {
    if (!selectedGameId) return
    setShowAddModal(true)
    setLoadingEligible(true)
    setError(null)

    try {
      // 1. Events attached to this game
      const { data: gel, error: gelErr } = await supabase
        .from('game_events_list')
        .select('ge_list_id')
        .eq('game_id', selectedGameId)
      if (gelErr) throw gelErr
      const geListIds = (gel ?? []).map((g) => g.ge_list_id)

      if (geListIds.length === 0) {
        setEligibleAthletes([])
        setLoadingEligible(false)
        return
      }

      // 2. Heats under those events
      const { data: heatsData, error: heatsErr } = await supabase
        .from('heats')
        .select('heat_id')
        .in('ge_list_id', geListIds)
      if (heatsErr) throw heatsErr
      const heatIds = (heatsData ?? []).map((h) => h.heat_id)

      if (heatIds.length === 0) {
        setEligibleAthletes([])
        setLoadingEligible(false)
        return
      }

      // 3. Athletes entered in those heats
      const { data: ahData, error: ahErr } = await supabase
        .from('athlete_heats')
        .select('athlete_id')
        .in('heat_id', heatIds)
      if (ahErr) throw ahErr
      const enteredAthleteIds = Array.from(new Set((ahData ?? []).map((a) => a.athlete_id)))

      // 4. Exclude athletes already featured for this game
      const alreadyFeaturedIds = new Set(featured.map((f) => f.athlete_id))
      const eligibleIds = enteredAthleteIds.filter((id) => !alreadyFeaturedIds.has(id))

      if (eligibleIds.length === 0) {
        setEligibleAthletes([])
        setLoadingEligible(false)
        return
      }

      // 5. Fetch display info for eligible athletes
      const { data: athletesData, error: athletesErr } = await supabase
        .from('athletes')
        .select('athlete_id, display_name, sport')
        .in('athlete_id', eligibleIds)
      if (athletesErr) throw athletesErr

      setEligibleAthletes(athletesData ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load eligible athletes')
      setEligibleAthletes([])
    }

    setLoadingEligible(false)
  }

  function closeAddModal() {
    setShowAddModal(false)
    setEligibleAthletes([])
  }

  async function handleAddAthlete(athlete: EligibleAthlete) {
    if (!selectedGameId) return
    setAddingId(athlete.athlete_id)
    setError(null)

    const nextPosition = featured.length + 1

    const { data, error } = await supabase
      .from('featured_athletes')
      .insert({
        game_id: selectedGameId,
        athlete_id: athlete.athlete_id,
        sort_position: nextPosition,
      })
      .select('fa_id, sort_position')
      .single()

    if (error) {
      setError(error.message)
      setAddingId(null)
      return
    }

    setFeatured((prev) => [
      ...prev,
      {
        fa_id: data.fa_id,
        athlete_id: athlete.athlete_id,
        sort_position: data.sort_position,
        display_name: athlete.display_name,
        sport: athlete.sport,
      },
    ])
    setEligibleAthletes((prev) => prev.filter((a) => a.athlete_id !== athlete.athlete_id))
    setAddingId(null)
  }

  return (
    <div>
      <PageHeader
        breadcrumb="Featured Athletes"
        title="Featured Athletes"
        description="Choose and order the athletes highlighted across the app for each game. Order is set manually — use the arrows to move an athlete up or down."
      />

      <div className="fa-page-body">
        {error && <p className="state-message error">{error}</p>}

        <div className="fa-layout">
          <div className="fa-games-panel">
            {loadingGames && <p className="state-message">Loading…</p>}
            {!loadingGames &&
              games.map((g) => (
                <button
                  key={g.game_id}
                  className={'fa-game-btn' + (g.game_id === selectedGameId ? ' fa-game-btn-active' : '')}
                  onClick={() => setSelectedGameId(g.game_id)}
                >
                  {g.game_name}
                </button>
              ))}
            {!loadingGames && games.length === 0 && (
              <p className="state-message">No games found.</p>
            )}
          </div>

          <div className="fa-list-panel">
            <div className="fa-list-header">
              <button
                className="btn-primary fa-add-btn"
                onClick={openAddModal}
                disabled={!selectedGameId}
              >
                + Add Athlete
              </button>
            </div>

            {loadingFeatured && <p className="state-message">Loading…</p>}

            {!loadingFeatured && (
              <div className="fa-list">
                {featured.map((f, idx) => (
                  <div className="fa-row" key={f.fa_id}>
                    <span className="fa-index">{idx + 1}</span>
                    <span className="fa-avatar" />
                    <div className="fa-info">
                      <div className="fa-name">{f.display_name || f.athlete_id}</div>
                      <div className="fa-sport muted">{f.sport || '—'}</div>
                    </div>
                    <div className="fa-actions">
                      <button
                        className="fa-arrow-btn"
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0 || reordering}
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="fa-arrow-btn"
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === featured.length - 1 || reordering}
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                      <span className="btn-link fa-remove" onClick={() => handleRemove(f.fa_id)}>
                        Remove
                      </span>
                    </div>
                  </div>
                ))}
                {featured.length === 0 && (
                  <p className="state-message">No featured athletes for this game yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fa-modal-overlay" onClick={closeAddModal}>
          <div className="fa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fa-modal-header">
              <div>
                <h2>Add Featured Athlete — {selectedGame?.game_name ?? ''}</h2>
                <p className="card-subtitle">
                  Only athletes entered in this game's heats can be featured.
                </p>
              </div>
              <span className="fa-modal-close" onClick={closeAddModal}>
                Close ✕
              </span>
            </div>

            <div className="fa-modal-body">
              {loadingEligible && <p className="state-message">Loading…</p>}
              {!loadingEligible &&
                eligibleAthletes.map((a) => (
                  <div className="fa-modal-row" key={a.athlete_id}>
                    <span className="fa-avatar" />
                    <div className="fa-info">
                      <div className="fa-name">{a.display_name || a.athlete_id}</div>
                      <div className="fa-sport muted">{a.sport || '—'}</div>
                    </div>
                    <button
                      className="btn-link fa-add-link"
                      onClick={() => handleAddAthlete(a)}
                      disabled={addingId === a.athlete_id}
                    >
                      {addingId === a.athlete_id ? 'Adding…' : '+ Add'}
                    </button>
                  </div>
                ))}
              {!loadingEligible && eligibleAthletes.length === 0 && (
                <p className="state-message">
                  No remaining athletes are entered in this game's heats.
                </p>
              )}
            </div>

            <div className="fa-modal-footer">
              <button className="btn-primary" onClick={closeAddModal}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
