import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BRANDS, CONNECTORS } from '../constants';
import { getVehicles, addVehicle, updateVehicle, deleteVehicle, deleteMyAccount } from '../services/api';
import { useAuth } from '../context/AuthContext';

const EMPTY = { brand: '', model: '', battery_kwh: '', connector_type: '', plate: '' };

const Field = ({ label, field, errors, children }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
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
    if (!f.brand)                                     e.brand        = 'Gerekli';
    if (!f.model.trim())                              e.model        = 'Gerekli';
    if (!f.battery_kwh || +f.battery_kwh < 10 || +f.battery_kwh > 220)
                                                      e.battery_kwh  = '10 – 220 kWh arasında olmalı';
    if (!f.connector_type)                            e.connector_type = 'Gerekli';
    if (!f.plate.trim())                              e.plate        = 'Gerekli';
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
      setMsg(`Araç kaydedildi! PIN kodunuz: ${newVehicle.vehicle_pin}`);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bu aracı silmek istediğinizden emin misiniz?')) return;
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
    `w-full border ${errs[field] ? 'border-red-500 bg-red-900/20' : 'border-slate-600'} bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition`;

  // ── Edit Modal ──
  const editModal = editVehicle && createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setEditVehicle(null); }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-white">Aracı Düzenle</h3>
          <button onClick={() => setEditVehicle(null)} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleEditSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Marka</label>
            <select className={ic('brand', {})} value={editForm.brand}
              onChange={e => setEditForm(f => ({ ...f, brand: e.target.value }))}>
              <option value="">Marka seçin…</option>
              {BRANDS.map(b => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Model</label>
            <input className={ic('model', {})} value={editForm.model}
              onChange={e => setEditForm(f => ({ ...f, model: e.target.value }))} placeholder="örn. Model 3" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Batarya (kWh)</label>
            <input type="number" className={ic('battery_kwh', {})} value={editForm.battery_kwh}
              onChange={e => setEditForm(f => ({ ...f, battery_kwh: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Konektör</label>
            <select className={ic('connector_type', {})} value={editForm.connector_type}
              onChange={e => setEditForm(f => ({ ...f, connector_type: e.target.value }))}>
              <option value="">Seçin…</option>
              {CONNECTORS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Plaka</label>
            <input className={ic('plate', {})} value={editForm.plate}
              onChange={e => setEditForm(f => ({ ...f, plate: e.target.value.toUpperCase() }))} />
          </div>
          {editError && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{editError}</div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={editLoading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm">
              {editLoading ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            <button type="button" onClick={() => setEditVehicle(null)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl text-sm">
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );

  // ── Hesap Silme Onay Modal ──
  const deleteConfirmModal = showDeleteConfirm && createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
    >
      <div className="bg-slate-800 border border-red-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-red-400 flex items-center gap-2">
            🗑️ Hesabı Sil
          </h3>
          <button onClick={() => setShowDeleteConfirm(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 text-sm text-red-300 space-y-1">
            <p className="font-semibold">Bu işlem geri alınamaz!</p>
            <p className="text-red-400/80">Tüm araçlarınız, rezervasyonlarınız ve hesap bilgileriniz kalıcı olarak silinecek.</p>
          </div>
          <p className="text-slate-300 text-sm">Hesabınızı silmek istediğinizden emin misiniz?</p>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleDeleteAccount}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Evet, Hesabımı Sil
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
            >
              Vazgeç
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
        <h1 className="text-2xl font-bold text-white">Araçlarım</h1>
        <p className="text-slate-400 mt-1 text-sm">Araçlarınızı kaydedin, uyumluluk kontrolü ve rezervasyon yapabilin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Registration Form */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-sm p-6">
          <h2 className="font-semibold text-white mb-5">Yeni Araç Ekle</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Marka" field="brand" errors={errors}>
              <select className={ic('brand')} value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                <option value="">Marka seçin…</option>
                {BRANDS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </Field>
            <Field label="Model" field="model" errors={errors}>
              <input className={ic('model')} placeholder="örn. Model 3, i4, e-tron"
                value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </Field>
            <Field label="Batarya Kapasitesi (kWh)" field="battery_kwh" errors={errors}>
              <input type="number" className={ic('battery_kwh')} placeholder="örn. 75"
                value={form.battery_kwh} onChange={(e) => setForm({ ...form, battery_kwh: e.target.value })} />
            </Field>
            <Field label="Konektör Tipi" field="connector_type" errors={errors}>
              <select className={ic('connector_type')} value={form.connector_type}
                onChange={(e) => setForm({ ...form, connector_type: e.target.value })}>
                <option value="">Konektör seçin…</option>
                {CONNECTORS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Plaka" field="plate" errors={errors}>
              <input className={ic('plate')} placeholder="örn. 35 EV 2024"
                value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} />
            </Field>

            {msg && <div className="bg-emerald-900/40 border border-emerald-700 text-emerald-300 rounded-lg p-3 text-sm">✅ {msg}</div>}
            {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
              {loading ? 'Kaydediliyor...' : 'Aracı Kaydet'}
            </button>
          </form>
        </div>

        {/* Vehicle List */}
        <div>
          <h2 className="font-semibold text-white mb-4">Kayıtlı Araçlar ({vehicles.length})</h2>

          {vehicles.length === 0 ? (
            <div className="bg-slate-800 rounded-2xl border border-dashed border-slate-600 p-14 text-center text-slate-400">
              <div className="text-5xl mb-3">🚗</div>
              <p className="text-sm">Henüz araç yok. İlk aracınızı ekleyin!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vehicles.map((v) => (
                <div key={v.id} onClick={() => setSelectedVehicle(selectedVehicle?.id === v.id ? null : v)}
                  className={`bg-slate-800 rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                    selectedVehicle?.id === v.id
                      ? 'border-emerald-500 shadow-md shadow-emerald-900/30'
                      : 'border-slate-700 hover:border-emerald-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-white">{v.brand} {v.model}</p>
                      <p className="text-slate-400 text-sm">{v.plate}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedVehicle?.id === v.id && (
                        <span className="bg-emerald-900/50 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-semibold">✓ Seçili</span>
                      )}
                      <button onClick={(e) => openEdit(v, e)}
                        className="text-slate-400 hover:text-emerald-400 text-sm transition-colors p-1" title="Düzenle">
                        ✏️
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(v.id); }}
                        className="text-slate-500 hover:text-red-400 text-sm transition-colors p-1" title="Sil">
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-300">
                    <span>🔋 <strong>{v.battery_kwh} kWh</strong></span>
                    <span>🔌 <strong>{v.connector_type}</strong></span>
                    {v.vehicle_pin && (
                      <span className="text-yellow-400 font-mono">📌 PIN: <strong>{v.vehicle_pin}</strong></span>
                    )}
                  </div>
                </div>
              ))}

              {selectedVehicle && (
                <div className="mt-1 space-y-2">
                  <div className="bg-emerald-900/30 border border-emerald-800 rounded-xl px-4 py-2.5 text-xs text-emerald-300 flex items-center gap-2">
                    <span>✓ Seçili:</span>
                    <span className="font-semibold">{selectedVehicle.brand} {selectedVehicle.model}</span>
                    <span className="ml-auto bg-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                      🔌 {selectedVehicle.connector_type}
                    </span>
                  </div>
                  <button
                    onClick={() => setView('map')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                  >
                    Şarj İstasyonu Bul →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Hesap Silme ── */}
      <div className="mt-10 pt-6 border-t border-slate-700/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-400">Tehlikeli Bölge</p>
            <p className="text-xs text-slate-500 mt-0.5">Hesabınızı kalıcı olarak silin. Bu işlem geri alınamaz.</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deletingAccount}
            className="shrink-0 bg-red-900/40 hover:bg-red-800/60 border border-red-700 text-red-400 text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {deletingAccount ? 'Siliniyor…' : '🗑️ Hesabımı Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}
