import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BRANDS, CONNECTORS } from '../constants';
import { getVehicles, addVehicle, updateVehicle, deleteVehicle, deleteMyAccount } from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY = { brand: '', model: '', battery_kwh: '', connector_type: '', plate: '' };

const Field = ({ label, field, errors, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
      {label}
    </label>
    {children}
    {errors[field] && <p className="text-red-400 text-xs mt-1">{errors[field]}</p>}
  </div>
);

export default function VehicleRegistration({
  vehicles, setVehicles,
  selectedVehicle, setSelectedVehicle,
  setView,
}) {
  const { logout } = useAuth();
  const [form,    setForm]    = useState(EMPTY);
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState('');
  const [error,   setError]   = useState('');
  const [deletingAccount,    setDeletingAccount]    = useState(false);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);

  // Edit modal state
  const [editVehicle, setEditVehicle] = useState(null); // vehicle being edited
  const [editForm,    setEditForm]    = useState(EMPTY);
  const [editLoading, setEditLoading] = useState(false);
  const [editError,   setEditError]   = useState('');

  useEffect(() => {
    getVehicles().then(setVehicles).catch(() => {});
  }, []);

  const validate = (f) => {
    const e = {};
    if (!f.brand)                                     e.brand        = 'Required';
    if (!f.model.trim())                              e.model        = 'Required';
    if (!f.battery_kwh || +f.battery_kwh < 10 || +f.battery_kwh > 220)
                                                      e.battery_kwh  = 'Must be between 10 – 220 kWh';
    if (!f.connector_type)                            e.connector_type = 'Required';
    if (!f.plate.trim())                              e.plate        = 'Required';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true); setError(''); setMsg('');
    try {
      const newVehicle = await addVehicle({
        brand: form.brand, model: form.model, plate: form.plate,
        battery_kwh: parseFloat(form.battery_kwh), connector_type: form.connector_type,
      });
      const updated = await getVehicles();
      setVehicles(updated);
      setSelectedVehicle(newVehicle);
      setForm(EMPTY); setErrors({});
      setMsg(`Vehicle saved! Your PIN code: ${newVehicle.vehicle_pin}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await deleteVehicle(id);
      const updated = await getVehicles();
      setVehicles(updated);
      if (selectedVehicle?.id === id) setSelectedVehicle(null);
    } catch (err) { setError(err.message); }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setShowDeleteConfirm(false);
    try {
      await deleteMyAccount();
      await logout();
    } catch (err) {
      setError(err.message);
      setDeletingAccount(false);
    }
  };

  const openEdit = (v, e) => {
    e.stopPropagation();
    setEditVehicle(v);
    setEditForm({ brand: v.brand, model: v.model, battery_kwh: v.battery_kwh, connector_type: v.connector_type, plate: v.plate });
    setEditError('');
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    const errs = validate(editForm);
    if (Object.keys(errs).length) { setEditError(Object.values(errs)[0]); return; }
    setEditLoading(true); setEditError('');
    try {
      await updateVehicle(editVehicle.id, {
        brand: editForm.brand, model: editForm.model, plate: editForm.plate,
        battery_kwh: parseFloat(editForm.battery_kwh), connector_type: editForm.connector_type,
      });

      const updated = await getVehicles();
      setVehicles(updated);
      if (selectedVehicle?.id === editVehicle.id) {
        setSelectedVehicle(updated.find(v => v.id === editVehicle.id) || null);
      }
      setEditVehicle(null);
    } catch (err) { setEditError(err.message); }
    finally { setEditLoading(false); }
  };

  const ic = (field, errs = errors) =>
    `w-full border ${errs[field] ? 'border-red-500 bg-red-900/20' : 'border-gray-300'} bg-gray-100 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition`;

  //  Edit Modal 
  const editModal = editVehicle && createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setEditVehicle(null); }}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Edit Vehicle</h3>
          <button onClick={() => setEditVehicle(null)} className="text-gray-500 hover:text-white text-xl"></button>
        </div>
        <form onSubmit={handleEditSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Brand</label>
            <select className={ic('brand', {})} value={editForm.brand}
              onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))}>
              <option value="">Select brand…</option>
              {BRANDS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Model</label>
            <input className={ic('model', {})} value={editForm.model}
              onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} placeholder="e.g. Model 3" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Battery (kWh)</label>
            <input type="number" className={ic('battery_kwh', {})} value={editForm.battery_kwh}
              onChange={e => setEditForm(f => ({ ...f, battery_kwh: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Connector</label>
            <select className={ic('connector_type', {})} value={editForm.connector_type}
              onChange={e => setEditForm(f => ({ ...f, connector_type: e.target.value }))}>
              <option value="">Select…</option>
              {CONNECTORS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Plate</label>
            <input className={ic('plate', {})} value={editForm.plate}
              onChange={e => setEditForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} />
          </div>
          {editError && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{editError}</div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={editLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">
              {editLoading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setEditVehicle(null)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-white font-semibold py-2.5 rounded-xl text-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );

  //  Hesap Silme Onay Modal 
  const deleteConfirmModal = showDeleteConfirm && createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
    >
      <div className="bg-white border border-red-800 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-red-400 flex items-center gap-2">
             Delete Account
          </h3>
          <button onClick={() => setShowDeleteConfirm(false)} className="text-gray-500 hover:text-white text-xl"></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300 space-y-1">
            <p className="font-semibold">This action cannot be undone!</p>
            <p className="text-red-400/80">All your vehicles, reservations and account information will be permanently deleted.</p>
          </div>
          <p className="text-gray-700 text-sm">Are you sure you want to delete your account?</p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleDeleteAccount}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Yes, Delete My Account
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      {editModal}
      {deleteConfirmModal}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Vehicles</h1>
        <p className="text-gray-500 mt-1 text-sm">Register your vehicles to check compatibility and make reservations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Registration Form */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-5">Add New Vehicle</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Brand" field="brand" errors={errors}>
              <select className={ic('brand')} value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                <option value="">Select brand…</option>
                {BRANDS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Model" field="model" errors={errors}>
              <input className={ic('model')} placeholder="e.g. Model 3, i4, e-tron"
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="Battery Capacity (kWh)" field="battery_kwh" errors={errors}>
              <input type="number" className={ic('battery_kwh')} placeholder="e.g. 75"
                value={form.battery_kwh} onChange={(e) => setForm({ ...form, battery_kwh: e.target.value })} />
            </Field>
            <Field label="Connector Type" field="connector_type" errors={errors}>
              <select className={ic('connector_type')} value={form.connector_type}
                onChange={(e) => setForm({ ...form, connector_type: e.target.value })}>
                <option value="">Select connector…</option>
                {CONNECTORS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Plate" field="plate" errors={errors}>
              <input className={ic('plate')} placeholder="e.g. 35 EV 2024"
                value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} />
            </Field>

            {msg && <div className="bg-blue-900/40 border border-blue-700 text-blue-300 rounded-lg p-3 text-sm"> {msg}</div>}
            {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              {loading ? 'Saving...' : 'Save Vehicle'}
            </button>
          </form>
        </div>

        {/* Vehicle List */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">Registered Vehicles ({vehicles.length})</h2>

          {vehicles.length === 0 ? (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-14 text-center text-gray-500">
              <div className="text-5xl mb-3"></div>
              <p className="text-sm">No vehicles yet. Add your first vehicle!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.map((v) => (
                <div key={v.id} onClick={() => setSelectedVehicle(selectedVehicle?.id === v.id ? null : v)}
                  className={`bg-white rounded-lg border-2 p-5 cursor-pointer transition-all ${
                    selectedVehicle?.id === v.id
                      ? 'border-blue-500 shadow-md shadow-blue-900/30'
                      : 'border-gray-200 hover:border-blue-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{v.brand} {v.model}</p>
                      <p className="text-gray-500 text-sm">{v.plate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedVehicle?.id === v.id && (
                        <span className="bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full font-semibold">Selected</span>
                      )}
                      <button onClick={(e) => openEdit(v, e)}
                        className="text-gray-500 hover:text-blue-500 transition-colors p-1 rounded" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-700">
                    <span> <strong>{v.battery_kwh} kWh</strong></span>
                    <span> <strong>{v.connector_type}</strong></span>
                    {v.vehicle_pin && (
                      <span className="text-yellow-400 font-mono"> PIN: <strong>{v.vehicle_pin}</strong></span>
                    )}
                  </div>
                </div>
              ))}

              {selectedVehicle && (
                <div className="mt-1 space-y-2">
                  <div className="bg-blue-50 border border-blue-300 rounded-xl px-4 py-2.5 text-xs text-blue-700 flex items-center gap-2">
                    <span className="font-medium">Selected:</span>
                    <span className="font-semibold">{selectedVehicle.brand} {selectedVehicle.model}</span>
                    <span className="ml-auto bg-blue-600 text-white px-2 py-0.5 rounded-full font-mono font-semibold">
                      {selectedVehicle.connector_type}
                    </span>
                  </div>
                  <button
                    onClick={() => setView('map')}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    Find Charging Station →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/*  Hesap Silme  */}
      <div className="mt-10 pt-6 border-t border-gray-200/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-400">Danger Zone</p>
            <p className="text-xs text-gray-400 mt-0.5">Permanently delete your account. This cannot be undone.</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deletingAccount}
            className="shrink-0 bg-red-700 hover:bg-red-600 border border-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {deletingAccount ? 'Deleting…' : ' Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
