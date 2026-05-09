import { useState, useEffect, useRef } from 'react'
import { fmtTime } from '../utils/helpers'

const TOTAL_SIM_SECS = 90 // 90 real seconds = full charge (demo speed)

export default function ChargingSession({ activeSession, setActiveSession, setView }) {
  const [elapsed, setElapsed] = useState(0)
  const [kwh,     setKwh]     = useState(0)
  const [done,    setDone]    = useState(false)
  const timerRef  = useRef(null)

  useEffect(() => {
    if (!activeSession || done) return
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        const next    = e + 1
        const charged = Math.min((next / TOTAL_SIM_SECS) * activeSession.totalKwh, activeSession.totalKwh)
        setKwh(charged)
        if (charged >= activeSession.totalKwh) {
          clearInterval(timerRef.current)
          setDone(true)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [activeSession])

  /* ─── No session ─── */
  if (!activeSession) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-14">
          <div className="text-5xl mb-4">⚡</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No Active Session</h2>
          <p className="text-slate-400 text-sm mb-6">Complete a reservation first to start charging.</p>
          <button
            onClick={() => setView('reservation')}
            className="bg-green-600 text-white px-6 py-2.5 rounded-xl hover:bg-green-700 text-sm font-semibold transition-colors"
          >
            Go to Reservation
          </button>
        </div>
      </div>
    )
  }

  const { station, charger, vehicle, startBattery, targetBattery, totalKwh } = activeSession
  const price     = charger?.price || 4.0
  const battPct   = startBattery + (kwh / totalKwh) * (targetBattery - startBattery)
  const cost      = (kwh * price).toFixed(2)
  const progress  = (kwh / totalKwh) * 100

  /* ─── Completed ─── */
  if (done) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-5">
            🎉
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Charging Complete!</h2>
          <p className="text-slate-400 text-sm mb-6">
            Your {vehicle.brand} {vehicle.model} is fully charged.
          </p>

          <div className="bg-slate-50 rounded-xl p-5 text-left space-y-2.5 text-sm mb-6">
            {[
              ['Station',          station.name],
              ['Charger',          `${charger.id} · ${charger.type} ${charger.power}kW`],
              ['Vehicle',          `${vehicle.brand} ${vehicle.model} (${vehicle.plate})`],
              ['Battery',          `${startBattery}% → ${targetBattery}%`],
              ['Energy Consumed',  `${totalKwh.toFixed(1)} kWh`],
              ['Session Duration', fmtTime(elapsed)],
              ['Unit Price',       `${price} TL/kWh`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-800">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2.5">
              <span className="font-bold text-slate-900">Total Cost</span>
              <span className="font-bold text-green-600 text-xl">
                {(totalKwh * price).toFixed(2)} TL
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
              onClick={() => alert('Digital receipt would be emailed to the user.')}
            >
              📄 Digital Receipt
            </button>
            <button
              onClick={() => { setActiveSession(null); setView('vehicles') }}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Active Session ─── */
  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Active Session</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {station?.name} · {charger?.id}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Charging
        </div>
      </div>

      {/* Battery card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-slate-700">Battery Level</span>
          <span className="text-3xl font-bold text-slate-900">{Math.round(battPct)}%</span>
        </div>

        {/* Battery bar */}
        <div className="w-full h-9 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000 flex items-center justify-end pr-3"
            style={{ width: `${battPct}%` }}
          >
            {battPct > 15 && (
              <span className="text-white text-xs font-bold">{Math.round(battPct)}%</span>
            )}
          </div>
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>Start: {startBattery}%</span>
          <span>Target: {targetBattery}%</span>
        </div>

        {/* Energy progress */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-slate-600 font-medium">Energy Charged</span>
            <span className="text-sm font-semibold">
              {kwh.toFixed(1)} / {totalKwh.toFixed(1)} kWh
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {[
          { label: 'Cost So Far',      value: `${cost} TL`,              color: 'text-green-600' },
          { label: 'Session Duration', value: fmtTime(elapsed),          color: 'text-slate-800' },
          { label: 'Charging Power',   value: `${charger?.power} kW`,    color: 'text-blue-600'  },
          { label: 'Energy Consumed',  value: `${kwh.toFixed(1)} kWh`,   color: 'text-slate-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => { clearInterval(timerRef.current); setDone(true) }}
        className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 rounded-xl border border-red-200 transition-colors"
      >
        Stop Charging Session
      </button>
    </div>
  )
}
