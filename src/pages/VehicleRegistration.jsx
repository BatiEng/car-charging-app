import { useState } from 'react'
import { BRANDS, CONNECTORS } from '../data/stations'

const EMPTY = { brand: '', model: '', battery: '', connector: '', plate: '' }

const Field = ({ label, field, errors, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
      {label}
    </label>
    {children}
    {errors[field] && <p className="text-red-500 text-xs mt-1">{errors[field]}</p>}
  </div>
)

export default function VehicleRegistration({
  vehicles, setVehicles,
  selectedVehicle, setSelectedVehicle,
  setView,
}) {
  const [form,   setForm]   = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [ok,     setOk]     = useState(false)

  const validate = () => {
    const e = {}
    if (!form.brand)                                 e.brand     = 'Required'
    if (!form.model.trim())                          e.model     = 'Required'
    if (!form.battery || +form.battery < 10 || +form.battery > 220)
                                                     e.battery   = 'Must be 10 – 220 kWh'
    if (!form.connector)                             e.connector = 'Required'
    if (!form.plate.trim())                          e.plate     = 'Required'
    return e
  }

  const handleSubmit = () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setVehicles((v) => [...v, { id: Date.now(), ...form, battery: +form.battery }])
    setForm(EMPTY)
    setErrors({})
    setOk(true)
    setTimeout(() => setOk(false), 3000)
  }

  const ic = (field) =>
    `w-full border ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-slate-300'
    } rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition`



  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">My Vehicles</h1>
        <p className="text-slate-400 mt-1 text-sm">
          Register your EV to enable charger compatibility checks and reservations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Registration Form ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-semibold text-slate-800 mb-5">Register New Vehicle</h2>
          <div className="space-y-4">

            <Field label="Brand" field="brand" errors={errors}>
              <select className={ic('brand')} value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                <option value="">Select brand…</option>
                {BRANDS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>

            <Field label="Model" field="model" errors={errors}>
              <input className={ic('model')} placeholder="e.g. Model 3, i4, e-tron"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>

            <Field label="Battery Capacity (kWh)" field="battery" errors={errors}>
              <input type="number" className={ic('battery')} placeholder="e.g. 75"
                value={form.battery}
                onChange={(e) => setForm({ ...form, battery: e.target.value })} />
            </Field>

            <Field label="Connector Type" field="connector" errors={errors}>
              <select className={ic('connector')} value={form.connector}
                onChange={(e) => setForm({ ...form, connector: e.target.value })}>
                <option value="">Select connector…</option>
                {CONNECTORS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Plate Number" field="plate" errors={errors}>
              <input className={ic('plate')} placeholder="e.g. 35 EV 2024"
                value={form.plate}
                onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} />
            </Field>

            {ok && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm flex items-center gap-2">
                ✅ Vehicle registered successfully!
              </div>
            )}

            <button
              onClick={handleSubmit}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              Register Vehicle
            </button>
          </div>
        </div>

        {/* ── Vehicle List ── */}
        <div>
          <h2 className="font-semibold text-slate-800 mb-4">
            Registered Vehicles ({vehicles.length})
          </h2>

          {vehicles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-14 text-center text-slate-400">
              <div className="text-5xl mb-3">🚗</div>
              <p className="text-sm">No vehicles yet. Register your first EV!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className={`bg-white rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                    selectedVehicle?.id === v.id
                      ? 'border-green-500 shadow-md shadow-green-100'
                      : 'border-slate-200 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{v.brand} {v.model}</p>
                      <p className="text-slate-400 text-sm">{v.plate}</p>
                    </div>
                    {selectedVehicle?.id === v.id && (
                      <span className="bg-green-100 text-green-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                        ✓ Selected
                      </span>
                    )}
                  </div>
                  <div className="flex gap-5 mt-3 text-sm text-slate-600">
                    <span>🔋 <strong>{v.battery} kWh</strong></span>
                    <span>🔌 <strong>{v.connector}</strong></span>
                  </div>
                </div>
              ))}

              {selectedVehicle && (
                <button
                  onClick={() => setView('map')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm mt-1"
                >
                  Find Charging Station →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
