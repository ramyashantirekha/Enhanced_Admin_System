import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AthletesPage from './pages/AthletesPage'
import AthleteFormPage from './pages/AthleteFormPage'
import SportingEventsPage from './pages/SportingEventsPage'
import EventFormPage from './pages/EventFormPage'
import GamesPage from './pages/GamesPage'
import GameFormPage from './pages/GameFormPage'
import HeatsPrizesPage from './pages/HeatsPrizesPage'
import SchedulePage from './pages/SchedulePage'
import ResultsEntryPage from './pages/ResultsEntryPage'
import NotificationsPage from './pages/NotificationsPage'
import NotificationFormPage from './pages/NotificationFormPage'
import FeaturedAthletesPage from './pages/FeaturedAthletesPage'
import MediaPage from './pages/MediaPage'
import MediaFormPage from './pages/MediaFormPage'
import CountriesPage from './pages/CountriesPage'
import CountryFormPage from './pages/CountryFormPage'
import SystemListsPage from './pages/SystemListsPage'
import SystemVariablesPage from './pages/SystemVariablesPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/athletes" element={<AthletesPage />} />
        <Route path="/athletes/new" element={<AthleteFormPage />} />
        <Route path="/athletes/edit/:athleteId" element={<AthleteFormPage />} />
        <Route path="/sporting-events" element={<SportingEventsPage />} />
        <Route path="/sporting-events/new" element={<EventFormPage />} />
        <Route path="/sporting-events/edit/:eventId" element={<EventFormPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/new" element={<GameFormPage />} />
        <Route path="/games/edit/:gameId" element={<GameFormPage />} />
        <Route path="/games/heats-prizes" element={<HeatsPrizesPage />} />
        <Route path="/games/schedule" element={<SchedulePage />} />
        <Route path="/games/results-entry" element={<ResultsEntryPage />} />
        <Route path="/games/notifications" element={<NotificationsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/notifications/new" element={<NotificationFormPage />} />
        <Route path="/notifications/edit/:notificationId" element={<NotificationFormPage />} />
        <Route path="/games/featured-athletes" element={<FeaturedAthletesPage />} />
        <Route path="/featured-athletes" element={<FeaturedAthletesPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/media/new" element={<MediaFormPage />} />
        <Route path="/media/edit/:mediaId" element={<MediaFormPage />} />
        <Route path="/countries" element={<CountriesPage />} />
        <Route path="/countries/new" element={<CountryFormPage />} />
        <Route path="/countries/edit/:countryCode" element={<CountryFormPage />} />
        <Route path="/system-lists" element={<SystemListsPage />} />
        <Route path="/system-variables" element={<SystemVariablesPage />} />
      </Route>
    </Routes>
  )
}

export default App
