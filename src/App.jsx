import { useState } from 'react'
import { useJsApiLoader } from '@react-google-maps/api'

import Sidebar             from './components/Sidebar'
import VehicleRegistration from './pages/VehicleRegistration'
import StationMap          from './pages/StationMap'
import Reservation         from './pages/Reservation'
import ChargingSession     from './pages/ChargingSession'

const GOOGLE_MAPS_LIBRARIES = ['places']

export default function App() {
  /* ── Google Maps API ── */
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  })

  /* ── Global state ── */
  const [view,            setView]            = useState('vehicles')
  const [vehicles,        setVehicles]        = useState([
    { id: 1, brand: 'Tesla', model: 'Model 3', battery: 75, connector: 'CCS', plate: '35 EV 2024' },
  ])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [selectedStation, setSelectedStation] = useState(null)
  const [reservation,     setReservation]     = useState(null)
  const [activeSession,   setActiveSession]   = useState(null)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar view={view} setView={setView} hasSession={!!activeSession} />

      {/* pb-16 on mobile = space for the fixed bottom nav bar */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {view === 'vehicles' && (
          <VehicleRegistration
            vehicles={vehicles}           setVehicles={setVehicles}
            selectedVehicle={selectedVehicle} setSelectedVehicle={setSelectedVehicle}
            setView={setView}
          />
        )}

        {view === 'map' && (
          <StationMap
            isLoaded={isLoaded}
            selectedStation={selectedStation} setSelectedStation={setSelectedStation}
            selectedVehicle={selectedVehicle}
            setView={setView}
          />
        )}

        {view === 'reservation' && (
          <Reservation
            isLoaded={isLoaded}
            selectedStation={selectedStation}
            selectedVehicle={selectedVehicle}
            setView={setView}
            setReservation={setReservation}
            setActiveSession={setActiveSession}
          />
        )}

        {view === 'session' && (
          <ChargingSession
            activeSession={activeSession}
            setActiveSession={setActiveSession}
            setView={setView}
          />
        )}
      </main>
    </div>
  )
}
