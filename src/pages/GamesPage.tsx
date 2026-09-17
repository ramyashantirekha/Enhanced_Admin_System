import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PageHeader from '../components/PageHeader'
import './GamesPage.css'

type Game = {
  game_id: string
  game_name: string
  start_date: string
  end_date: string
  game_type: string
  game_description: string | null
  ticketed_flag: string
  game_status: string
  game_image_url: string | null
}

function isLiveStatus(status: string) {
  return status.toUpperCase() === 'LIVE'
}

// Live game always floats to the top; everything else keeps its existing order.
function sortGames(list: Game[]) {
  return [...list].sort((a, b) => {
    const aLive = isLiveStatus(a.game_status) ? 0 : 1
    const bLive = isLiveStatus(b.game_status) ? 0 : 1
    return aLive - bLive
  })
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const sameDay = start === end

  if (sameDay) {
    return startDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const sameMonth =
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear()

  if (sameMonth) {
    const startDay = startDate.toLocaleDateString('en-US', { day: 'numeric' })
    const endStr = endDate.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    return `${startDay}–${endStr}`
  }

  return `${startDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  })} – ${endDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`
}

function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase()
  return <span className={`status-badge status-${key}`}>{status}</span>
}

export default function GamesPage() {
  const navigate = useNavigate()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settingLiveId, setSettingLiveId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchGames() {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('start_date', { ascending: false })

      if (error) {
        setError(error.message)
      } else {
        setGames(sortGames(data ?? []))
      }
      setLoading(false)
    }

    fetchGames()
  }, [])

  async function handleSetLive(gameId: string) {
    setError(null)
    setSettingLiveId(gameId)

    const previousLive = games.find((g) => isLiveStatus(g.game_status))

    try {
      if (previousLive && previousLive.game_id !== gameId) {
        const { error: archiveError } = await supabase
          .from('games')
          .update({ game_status: 'ARCHIVED' })
          .eq('game_id', previousLive.game_id)
        if (archiveError) throw archiveError
      }

      const { error: liveError } = await supabase
        .from('games')
        .update({ game_status: 'LIVE' })
        .eq('game_id', gameId)
      if (liveError) throw liveError

      setGames((prev) =>
        sortGames(
          prev.map((g) => {
            if (g.game_id === gameId) return { ...g, game_status: 'LIVE' }
            if (previousLive && g.game_id === previousLive.game_id) {
              return { ...g, game_status: 'ARCHIVED' }
            }
            return g
          })
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set game live.')
    } finally {
      setSettingLiveId(null)
    }
  }

  return (
    <div className="games-page">
      <PageHeader
        breadcrumb="Games / Competitions"
        title="Games"
        description="Create competitions, schedule future games, and control which one is live."
        action={<button onClick={() => navigate('/games/new')}>+ New Game</button>}
      />

      <div className="games-page-body">
        {loading && <p className="state-message">Loading games…</p>}
        {error && <p className="state-message error">{error}</p>}

        {!loading && (
          <>
            <div className="table-wrap">
              <table className="games-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => {
                    const isLive = isLiveStatus(game.game_status)
                    return (
                      <tr key={game.game_id}>
                        <td className="game-name">{game.game_name}</td>
                        <td className="muted">{game.game_type}</td>
                        <td className="muted">
                          {formatDateRange(game.start_date, game.end_date)}
                        </td>
                        <td>
                          <StatusBadge status={game.game_status} />
                        </td>
                        <td className="row-actions">
                          <button
                            className="btn-link"
                            onClick={() => navigate(`/games/edit/${game.game_id}`)}
                          >
                            Edit
                          </button>
                          {!isLive && (
                            <button
                              className="btn-link"
                              disabled={settingLiveId === game.game_id}
                              onClick={() => handleSetLive(game.game_id)}
                            >
                              {settingLiveId === game.game_id ? 'Setting…' : 'Set Live'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {games.length === 0 && (
                <p className="state-message">No games yet. Add your first one to get started.</p>
              )}
            </div>

            <p className="table-footnote">
              Setting a new game LIVE automatically archives whichever game was previously live —
              try "Set Live" on a different row.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
