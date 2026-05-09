import { useState, useRef, useCallback } from 'react'
import { GoogleMap, MarkerF, InfoWindowF, DirectionsRenderer } from '@react-google-maps/api'
import { STATIONS, USER_LOCATION, MAP_CENTER } from '../data/stations'
import { getStationStatus, getMarkerIcon, getUserMarkerIcon, STATUS_COLOR, STATUS_BADGE } from '../utils/helpers'

const MAP_STYLE = { width: '100%', height: '100%' }
const MAP_OPTIONS = {
  disableDefaultUI: false,
  clickableIcons: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
}

export default function StationMap({ isLoaded, selectedStation, setSelectedStation, selectedVehicle, setView }) {
  const mapRef        = useRef(null)
  const [filterConn,  setFilterConn]  = useState('all')
  const [filterPow,   setFilterPow]   = useState('all')
  const [infoStation, setInfoStation] = useState(null)
  const [directions,  setDirections]  = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)

  const onMapLoad = useCallback((map) => { mapRef.current = map }, [])

  const filtered = STATIONS.filter((s) => {
    const okConn = filterConn === 'all' || s.chargers.some((c) => c.connector === filterConn)
    const okPow  = filterPow  === 'all' || s.chargers.some((c) => {
      if (filterPow === 'slow')  return c.power <= 22
      if (filterPow === 'fast')  return c.power >= 50 && c.power < 150
      if (filterPow === 'rapid') return c.power >= 150
      return true
    })
    return okConn && okPow
  })

  const handleMarkerClick = (station) => {
    setInfoStation(station)
    setSelectedStation(station)
    setDirections(null)
    mapRef.current?.panTo({ lat: station.lat, lng: station.lng })
  }

  const handleShowRoute = () => {
    if (!infoStation) return
    setRouteLoading(true)
    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin:      USER_LOCATION,
        destination: { lat: infoStation.lat, lng: infoStation.lng },
        travelMode:  window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setRouteLoading(false)
        if (status === 'OK') {
          setDirections(result)
          setInfoStation(null) // close info window so route is visible
        } else {
          alert('Could not get directions: ' + status)
        }
      }
    )
  }

  const handleStationSelect = (station) => {
    setSelectedStation(station)
    setInfoStation(station)
    setDirections(null)
    mapRef.current?.panTo({ lat: station.lat, lng: station.lng })
    mapRef.current?.setZoom(14)
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Filter Bar ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Filters:</span>

        <select
          value={filterConn} onChange={(e) => setFilterConn(e.target.value)}
          className="text-xs sm:text-sm border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 flex-1 sm:flex-none"
        >
          <option value="all">All Connectors</option>
          <option value="CCS">CCS</option>
          <option value="CHAdeMO">CHAdeMO</option>
          <option value="Type 2">Type 2</option>
        </select>

        <select
          value={filterPow} onChange={(e) => setFilterPow(e.target.value)}
          className="text-xs sm:text-sm border border-slate-300 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-green-500 flex-1 sm:flex-none"
        >
          <option value="all">All Power Levels</option>
          <option value="slow">AC Slow (≤22 kW)</option>
          <option value="fast">DC Fast (50 kW)</option>
          <option value="rapid">DC Rapid (150 kW)</option>
        </select>

        {directions && (
          <button
            onClick={() => setDirections(null)}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            ✕ Route
          </button>
        )}

        {/* Legend — hidden on small screens */}
        <div className="hidden sm:flex ml-auto items-center gap-3 text-xs text-slate-400">
          {['available', 'occupied', 'offline'].map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATUS_COLOR[s] }} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block bg-blue-500" />
            You
          </span>
        </div>
      </div>

      {/* ── Map + Right Panel ── */}
      {/* Mobile: stack vertically. Desktop: side-by-side */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Map — 55vh on mobile, flex-1 on desktop */}
        <div className="h-[55vh] md:h-auto md:flex-1 relative shrink-0 md:shrink">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse">🗺️</div>
                <p className="text-slate-500 text-sm">Loading Google Maps…</p>
              </div>
            </div>
          )}

          {isLoaded && (
            <GoogleMap
              mapContainerStyle={MAP_STYLE}
              center={MAP_CENTER}
              zoom={12}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}
            >
              {/* User location */}
              <MarkerF
                position={USER_LOCATION}
                icon={getUserMarkerIcon()}
                title="Your Location (Alsancak, İzmir)"
                zIndex={100}
              />

              {/* Station markers */}
              {filtered.map((station) => {
                const status = getStationStatus(station)
                return (
                  <MarkerF
                    key={station.id}
                    position={{ lat: station.lat, lng: station.lng }}
                    icon={getMarkerIcon(STATUS_COLOR[status])}
                    onClick={() => handleMarkerClick(station)}
                    title={station.name}
                  />
                )
              })}

              {/* Info Window */}
              {infoStation && (
                <InfoWindowF
                  position={{ lat: infoStation.lat, lng: infoStation.lng }}
                  onCloseClick={() => setInfoStation(null)}
                >
                  <div className="text-sm max-w-xs">
                    <p className="font-bold text-slate-900 mb-0.5">{infoStation.name}</p>
                    <p className="text-slate-500 text-xs mb-2">{infoStation.address}</p>
                    <div className="flex gap-3 text-xs text-slate-600 mb-3">
                      <span>📍 {infoStation.distance} km</span>
                      <span>⭐ {infoStation.rating}</span>
                      <span>
                        ⚡ {infoStation.chargers.filter((c) => c.status === 'available').length}/
                        {infoStation.chargers.length} free
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleShowRoute}
                        disabled={routeLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {routeLoading ? '⏳' : '🗺️ Route'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStation(infoStation)
                          setInfoStation(null)
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </InfoWindowF>
              )}

              {/* Route */}
              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{ suppressMarkers: false }}
                />
              )}
            </GoogleMap>
          )}
        </div>

        {/* ── Right Panel — full width below map on mobile, fixed 320px on desktop ── */}
        <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col overflow-hidden md:shrink-0">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">{filtered.length} stations found</p>
            <p className="text-xs text-slate-400">Near Alsancak, İzmir</p>
          </div>

          {/* Station list */}
          <div className="flex-1 overflow-y-auto">
            {[...filtered].sort((a, b) => a.distance - b.distance).map((station) => {
              const status = getStationStatus(station)
              const avail  = station.chargers.filter((c) => c.status === 'available').length
              const active = selectedStation?.id === station.id
              return (
                <div
                  key={station.id}
                  onClick={() => handleStationSelect(station)}
                  className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${
                    active ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm text-slate-800">{station.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status]}`}>
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{station.address}</p>
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    <span>📍 {station.distance} km</span>
                    <span>⚡ {avail}/{station.chargers.length} free</span>
                    <span>⭐ {station.rating}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Selected station detail */}
          {selectedStation && (
            <div className="border-t border-slate-200 bg-slate-50 p-4 shrink-0">
              <p className="font-semibold text-slate-800 text-sm mb-0.5">{selectedStation.name}</p>
              <p className="text-xs text-slate-400 mb-3">🕐 {selectedStation.hours}</p>

              <div className="space-y-1.5 mb-4">
                {selectedStation.chargers.map((c) => {
                  const compatible = selectedVehicle && selectedVehicle.connector === c.connector
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: STATUS_COLOR[c.status] }}
                      />
                      <span className="font-mono text-slate-600 w-12">{c.id}</span>
                      <span className="text-slate-700 flex-1">{c.type} {c.power}kW</span>
                      <span className="text-slate-400">{c.connector}</span>
                      {selectedVehicle && (
                        <span className={compatible ? 'text-green-600 font-bold' : 'text-red-400'}>
                          {compatible ? '✓' : '✗'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => {
                  if (!selectedVehicle) {
                    alert('⚠️ Please select a vehicle first from "My Vehicles"!')
                    return
                  }
                  setView('reservation')
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                {selectedVehicle ? 'Make Reservation →' : '⚠️ Select a vehicle first'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
