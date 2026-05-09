import { useState, useEffect } from 'react'
import { GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api'
import { OCCUPIED_SLOTS, USER_LOCATION } from '../data/stations'
import { getMarkerIcon, getUserMarkerIcon, STATUS_COLOR, pad2, todayISO, tomorrowISO } from '../utils/helpers'

const MAP_STYLE = { width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden' }

export default function Reservation({
  isLoaded,
  selectedStation, selectedVehicle,
  setView, setReservation, setActiveSession,
}) {
  const [charger,   setCharger]   = useState(null)
  const [date,      setDate]      = useState(todayISO())
  const [duration,  setDuration]  = useState(1)
  const [slot,      setSlot]      = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [resData,   setResData]   = useState(null)
  const [directions, setDirections] = useState(null)

  // Load route when reservation is confirmed
  useEffect(() => {
    if (!isLoaded || !confirmed || !resData) return
    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin:      USER_LOCATION,
        destination: { lat: resData.station.lat, lng: resData.station.lng },
        travelMode:  window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => { if (status === 'OK') setDirections(result) }
    )
  }, [isLoaded, confirmed, resData])

  /* ─── not ready ─── */
  if (!selectedStation || !selectedVehicle) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-14">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Nothing Selected</h2>
          <p className="text-slate-400 text-sm mb-6">
            Please register a vehicle and select a station on the map first.
          </p>
          <button onClick={() => setView('vehicles')}
            className="bg-green-600 text-white px-6 py-2.5 rounded-xl hover:bg-green-700 text-sm font-semibold mr-3 transition-colors">
            My Vehicles
          </button>
          <button onClick={() => setView('map')}
            className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-xl hover:bg-slate-200 text-sm font-semibold transition-colors">
            Find Station
          </button>
        </div>
      </div>
    )
  }

  /* ─── helpers ─── */
  const compatChargers = selectedStation.chargers.filter(
    (c) => c.connector === selectedVehicle.connector && c.status !== 'offline'
  )

  const getSlots = () => {
    const out = []
    for (let h = 8; h <= 21; h++) {
      if (h + duration > 22) continue
      const t     = `${pad2(h)}:00`
      const taken = charger && (OCCUPIED_SLOTS[charger.id] || []).includes(t)
      out.push({ time: t, endTime: `${pad2(h + duration)}:00`, taken })
    }
    return out
  }

  const estCost = charger ? (charger.power * duration * charger.price).toFixed(2) : '–'

  const handleConfirm = () => {
    const data = { station: selectedStation, charger, vehicle: selectedVehicle, date, slot, duration, estCost }
    setResData(data)
    setReservation(data)
    setConfirmed(true)
  }

  const handleStart = () => {
    setActiveSession({
      ...resData,
      startBattery:  20,
      targetBattery: 80,
      totalKwh:      resData.vehicle.battery * 0.60, // 20% → 80%
    })
    setView('session')
  }

  /* ─── Confirmed Screen ─── */
  if (confirmed && resData) {
    const endHour = pad2(+resData.slot.split(':')[0] + resData.duration)

    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✅
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Reservation Confirmed!</h2>
            <p className="text-slate-400 text-sm mt-1">Your charging slot has been reserved.</p>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-5 space-y-2.5 text-sm mb-5">
            {[
              ['Station',   resData.station.name],
              ['Charger',   `${resData.charger.id} · ${resData.charger.type} ${resData.charger.power}kW`],
              ['Connector', `${resData.charger.connector} ✓ Compatible`],
              ['Vehicle',   `${resData.vehicle.brand} ${resData.vehicle.model} (${resData.vehicle.plate})`],
              ['Date',      resData.date],
              ['Time',      `${resData.slot} – ${endHour}:00 (${resData.duration}h)`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-800">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2.5">
              <span className="font-semibold">Estimated Cost</span>
              <span className="font-bold text-green-600 text-lg">~{resData.estCost} TL</span>
            </div>
          </div>

          {/* Route Map */}
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-2">🗺️ Route to Station</p>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={MAP_STYLE}
                center={USER_LOCATION}
                zoom={12}
              >
                <Marker position={USER_LOCATION} icon={getUserMarkerIcon()} title="Your Location" />
                <Marker
                  position={{ lat: resData.station.lat, lng: resData.station.lng }}
                  icon={getMarkerIcon(STATUS_COLOR.available)}
                  title={resData.station.name}
                />
                {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
              </GoogleMap>
            ) : (
              <div className="h-[220px] bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                Loading map…
              </div>
            )}
          </div>

          <button
            onClick={handleStart}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            ⚡ Start Charging Session
          </button>
        </div>
      </div>
    )
  }

  /* ─── Booking Form ─── */
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Make a Reservation</h1>
        <p className="text-slate-400 mt-1 text-sm">Booking a slot at {selectedStation.name}</p>
      </div>

      {/* Context cards */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Station</p>
          <p className="font-semibold text-slate-800">{selectedStation.name}</p>
          <p className="text-sm text-slate-500">{selectedStation.address}</p>
          <p className="text-xs text-slate-400 mt-1">🕐 {selectedStation.hours}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Vehicle</p>
          <p className="font-semibold text-slate-800">{selectedVehicle.brand} {selectedVehicle.model}</p>
          <p className="text-sm text-slate-500">{selectedVehicle.plate}</p>
          <p className="text-xs text-slate-400 mt-1">🔌 {selectedVehicle.connector} · 🔋 {selectedVehicle.battery} kWh</p>
        </div>
      </div>

      {/* Step 1 – Charger */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
        <p className="font-semibold text-slate-800 mb-0.5">Step 1 — Select Charger</p>
        <p className="text-xs text-slate-400 mb-4">
          Only chargers compatible with your connector ({selectedVehicle.connector}) are shown
        </p>

        {compatChargers.length === 0 ? (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">
            ❌ No compatible chargers at this station for <strong>{selectedVehicle.connector}</strong>.
            Please choose a different station.
          </div>
        ) : (
          <div className="space-y-2">
            {compatChargers.map((c) => (
              <div
                key={c.id}
                onClick={() => { setCharger(c); setSlot(null) }}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  charger?.id === c.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-slate-200 hover:border-green-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: STATUS_COLOR[c.status] }}
                  />
                  <div>
                    <p className="font-mono font-semibold text-sm text-slate-700">{c.id}</p>
                    <p className="text-xs text-slate-400">{c.type} · {c.power} kW · {c.connector}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">{c.price} TL / kWh</p>
                  <p className={`text-xs ${c.status === 'available' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {c.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 – Date & Time */}
      {charger && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
          <p className="font-semibold text-slate-800 mb-4">Step 2 — Select Date & Time</p>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Date</label>
              <input
                type="date" min={todayISO()} max={tomorrowISO()} value={date}
                onChange={(e) => { setDate(e.target.value); setSlot(null) }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-amber-600 mt-1">⚠️ Max 24 hours in advance</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Duration</label>
              <select
                value={duration} onChange={(e) => { setDuration(+e.target.value); setSlot(null) }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value={1}>1 Hour</option>
                <option value={2}>2 Hours (maximum)</option>
              </select>
              <p className="text-xs text-amber-600 mt-1">⚠️ Max 2 hours per session</p>
            </div>
          </div>

          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Available Time Slots
          </label>
          <div className="grid grid-cols-5 gap-2">
            {getSlots().map((s) => (
              <button
                key={s.time}
                disabled={s.taken}
                onClick={() => setSlot(s.time)}
                className={`py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                  s.taken
                    ? 'bg-red-50 text-red-300 line-through cursor-not-allowed'
                    : slot === s.time
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-green-100'
                }`}
              >
                {s.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary & Confirm */}
      {charger && slot && (
        <div className="bg-white rounded-2xl border border-green-200 p-6">
          <p className="font-semibold text-slate-800 mb-4">Reservation Summary</p>
          <div className="space-y-2 text-sm mb-5">
            {[
              ['Charger',    `${charger.id} · ${charger.type} ${charger.power}kW`],
              ['Date',       date],
              ['Time Slot',  `${slot} – ${pad2(+slot.split(':')[0] + duration)}:00`],
              ['Duration',   `${duration} hour(s)`],
              ['Max Energy', `${charger.power * duration} kWh`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-800">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="font-semibold">Estimated Cost</span>
              <span className="font-bold text-green-600 text-lg">~{estCost} TL</span>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg p-3 mb-4 flex gap-2 items-center">
            ✅ <strong>{charger.connector}</strong> connector compatible with your {selectedVehicle.brand} {selectedVehicle.model}
          </div>

          <button
            onClick={handleConfirm}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Confirm Reservation
          </button>
        </div>
      )}
    </div>
  )
}
