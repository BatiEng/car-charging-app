import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import {
  getStations, updateStation,
  createCharger, updateCharger, deleteCharger, patchCharger,
  getMyIssues, patchIssue, getTechnicians,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MAP_CENTER, CONNECTORS } from '../constants';

const STATUS_BADGE = {
  available:   'bg-emerald-900/40 text-emerald-300 border border-emerald-800',
  occupied:    'bg-blue-900/40 text-blue-300 border border-blue-800',
  offline:     'bg-red-900/40 text-red-300 border border-red-800',
  active:      'bg-emerald-900/40 text-emerald-300 border border-emerald-800',
  inactive:    'bg-slate-700 text-slate-300 border border-slate-600',
  maintenance: 'bg-orange-900/40 text-orange-300 border border-orange-800',
};
const STATUS_DOT = {
  available:   '#34d399',
  occupied:    '#60a5fa',
  offline:     '#f87171',
  active:      '#34d399',
  inactive:    '#64748b',
  maintenance: '#fb923c',
};
const STATUS_LABELS         = { active:'✅ Aktif', inactive:'⛔ Pasif', maintenance:'🔧 Bakımda' };
const CHARGER_STATUS_LABELS = { available:'Müsait', occupied:'Dolu', offline:'Çevrimdışı' };
const STATION_STATUSES      = ['active', 'inactive', 'maintenance'];
const MINI_MAP_STYLE        = { width:'100%', height:'260px' };
const MINI_MAP_OPTIONS      = { disableDefaultUI:true, clickableIcons:false };
const EMPTY_CHARGER         = { charger_code:'', type:'AC', power:'', connector_type:'', price_per_kwh:'3.50' };

// ── ChargerList ───────────────────────────────────────────────
function ChargerList({ chargers, onChange, onDelete }) {
  const update = (idx, field, val) =>
    onChange(chargers.map((c, i) => i === idx ? { ...c, [field]: val } : c));

  return (
    <div className="space-y-3">
      {chargers.map((ch, idx) => (
        <div key={ch.id ?? `new-${idx}`}
          className="bg-slate-700/50 border border-slate-600 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              {ch._new ? `Yeni Şarjcı #${idx + 1}` : `Şarjcı #${idx + 1} (ID: ${ch.id})`}
            </span>
            <button type="button" onClick={() => onDelete(idx, ch)}
              className="text-xs text-red-400 hover:text-red-300">✕ Kaldır</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500">Kod *</label>
              <input value={ch.charger_code}
                onChange={e => update(idx, 'charger_code', e.target.value.toUpperCase())}
                placeholder="örn. ST1-01"
                className="w-full mt-0.5 bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs"/>
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Tip</label>
              <select value={ch.type} onChange={e => update(idx, 'type', e.target.value)}
                className="w-full mt-0.5 bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs">
                <option value="AC">AC</option>
                <option value="DC">DC</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500">Güç (kW) *</label>
              <input type="number" min="1" value={ch.power}
                onChange={e => update(idx, 'power', e.target.value)}
                placeholder="22"
                className="w-full mt-0.5 bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs"/>
            </div>
            <div>
              <label className="text-[10px] text-slate-500">TL/kWh</label>
              <input type="number" min="0" step="0.01" value={ch.price_per_kwh}
                onChange={e => update(idx, 'price_per_kwh', e.target.value)}
                className="w-full mt-0.5 bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs"/>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500">Konektör *</label>
            <select value={ch.connector_type} onChange={e => update(idx, 'connector_type', e.target.value)}
              className="w-full mt-0.5 bg-slate-700 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-xs">
              <option value="">Seçin…</option>
              {CONNECTORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Station Edit Modal ────────────────────────────────────────
function StationEditModal({ station, isLoaded, onClose, onSaved }) {
  const [form, setForm] = useState({
    id: station.id, name: station.name, address: station.address,
    status: station.status, lat: station.lat, lng: station.lng,
  });
  const [chargers,   setChargers]   = useState((station.chargers || []).map(c => ({ ...c, _new: false })));
  const [deletedIds, setDeletedIds] = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');

  const handleMapClick     = e => setForm(f => ({ ...f, lat: e.latLng.lat(), lng: e.latLng.lng() }));
  const handleAddCharger   = () => setChargers(cs => [...cs, { ...EMPTY_CHARGER, _new: true }]);
  const handleDeleteCharger = (idx, ch) => {
    if (!ch._new && ch.id) setDeletedIds(ids => [...ids, ch.id]);
    setChargers(cs => cs.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.name || !form.address) { setErr('Ad ve adres zorunlu'); return; }
    if (!form.lat  || !form.lng)     { setErr('Haritadan konum seçin'); return; }
    const filled = chargers.filter(c => c.charger_code || c.power || c.connector_type);
    for (const c of filled) {
      if (!c.charger_code || !c.power || !c.connector_type) { setErr('Tüm şarjcı alanlarını doldurun'); return; }
    }
    setSaving(true); setErr('');
    try {
      await updateStation(form.id, { name: form.name, address: form.address, status: form.status, lat: form.lat, lng: form.lng });
      for (const id of deletedIds) await deleteCharger(id);
      for (const c of filled.filter(c => !c._new))
        await updateCharger(c.id, { charger_code: c.charger_code, type: c.type, power: parseFloat(c.power), connector_type: c.connector_type, price_per_kwh: parseFloat(c.price_per_kwh) || 3.50 });
      for (const c of filled.filter(c => c._new))
        await createCharger({ station_id: form.id, charger_code: c.charger_code, type: c.type, power: parseFloat(c.power), connector_type: c.connector_type, price_per_kwh: parseFloat(c.price_per_kwh) || 3.50 });
      onSaved(); onClose();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <h3 className="font-semibold text-white">İstasyonu Düzenle</h3>
            <p className="text-slate-400 text-xs mt-0.5">{station.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[85vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="text-xs text-slate-400">İstasyon Adı *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Adres *</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="text-xs text-slate-400">Durum</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm">
                  {STATION_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Enlem</label>
                  <input readOnly value={form.lat ?? ''} placeholder="Haritadan seç"
                    className="w-full mt-1 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 text-sm cursor-not-allowed"/>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Boylam</label>
                  <input readOnly value={form.lng ?? ''} placeholder="Haritadan seç"
                    className="w-full mt-1 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg px-3 py-2 text-sm cursor-not-allowed"/>
                </div>
              </div>
              <div className="border-t border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">⚡ Şarj Üniteleri</p>
                  <button type="button" onClick={handleAddCharger}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-emerald-400 px-2 py-1 rounded-lg">+ Ekle</button>
                </div>
                <ChargerList chargers={chargers} onChange={setChargers} onDelete={handleDeleteCharger}/>
                {chargers.length === 0 && (
                  <p className="text-xs text-slate-500 text-center py-3">Şarjcı yok. "+ Ekle" ile ekleyin.</p>
                )}
              </div>
              {err && <p className="text-red-400 text-sm">{err}</p>}
              <button onClick={handleSave} disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
                {saving ? 'Kaydediliyor…' : '✓ Değişiklikleri Kaydet'}
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-2">📍 Haritaya tıklayarak konumu güncelleyin</p>
              {!isLoaded ? (
                <div className="flex items-center justify-center bg-slate-700 rounded-xl h-64">
                  <p className="text-slate-400 text-sm animate-pulse">Harita yükleniyor…</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-slate-600">
                  <GoogleMap
                    mapContainerStyle={MINI_MAP_STYLE}
                    center={(form.lat && form.lng) ? { lat: parseFloat(form.lat), lng: parseFloat(form.lng) } : MAP_CENTER}
                    zoom={13} options={MINI_MAP_OPTIONS} onClick={handleMapClick}
                  >
                    {form.lat && form.lng && <MarkerF position={{ lat: parseFloat(form.lat), lng: parseFloat(form.lng) }}/>}
                  </GoogleMap>
                </div>
              )}
              {form.lat && (
                <p className="text-xs text-emerald-400 mt-2">✓ {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Stat Card ─────────────────────────────────────────────────
function StatCard({ icon, label, value, color = 'text-white' }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-slate-400 text-xs">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Charger Row ───────────────────────────────────────────────
function ChargerRow({ ch, onStatusChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-700/40 border border-slate-700 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_DOT[ch.status] || '#64748b' }}/>
        <span className="font-mono text-sm text-white">{ch.charger_code}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ch.status] || 'bg-slate-700 text-slate-300'}`}>
          {CHARGER_STATUS_LABELS[ch.status] ?? ch.status}
        </span>
      </div>
      <p className="text-xs text-slate-400 shrink-0">
        {ch.type} · {ch.power} kW · {ch.connector_type} · {ch.price_per_kwh} TL/kWh
      </p>
      <div className="flex gap-2 shrink-0">
        {ch.status !== 'available' && (
          <button onClick={() => onStatusChange(ch.id, 'available')}
            className="text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-200 px-3 py-1.5 rounded-lg transition-colors">✓ Müsait</button>
        )}
        {ch.status !== 'offline' && (
          <button onClick={() => onStatusChange(ch.id, 'offline')}
            className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded-lg transition-colors">Çevrimdışı</button>
        )}
        {ch.status !== 'occupied' && (
          <button onClick={() => onStatusChange(ch.id, 'occupied')}
            className="text-xs bg-blue-900 hover:bg-blue-800 text-blue-200 px-3 py-1.5 rounded-lg transition-colors">Dolu</button>
        )}
      </div>
    </div>
  );
}

const ISSUE_STATUS_STYLE = {
  open:        { badge: 'bg-red-900/40 text-red-300 border border-red-800',        label: '🔴 Açık' },
  in_progress: { badge: 'bg-yellow-900/40 text-yellow-300 border border-yellow-800', label: '🔧 Devam Ediyor' },
  resolved:    { badge: 'bg-emerald-900/40 text-emerald-300 border border-emerald-800', label: '✅ Çözüldü' },
};

// ── Main ──────────────────────────────────────────────────────
export default function OperatorDashboard({ isLoaded }) {
  const { user } = useAuth();
  const [stations,      setStations]      = useState([]);
  const [editing,       setEditing]       = useState(null);
  const [msg,           setMsg]           = useState('');
  const [loading,       setLoading]       = useState(true);
  const [issues,        setIssues]        = useState([]);
  const [technicians,   setTechnicians]   = useState([]);
  const [issuesOpen,    setIssuesOpen]    = useState(true);
  const [patchingId,    setPatchingId]    = useState(null);
  const [techModal,     setTechModal]     = useState(null); // { id, issueTitle, stationName }
  const [selectedTech,  setSelectedTech]  = useState('');

  const load = () => {
    setLoading(true);
    getStations().then(setStations).catch(() => {}).finally(() => setLoading(false));
    getMyIssues().then(setIssues).catch(() => {});
  };
  useEffect(() => {
    load();
    getTechnicians().then(setTechnicians).catch(() => {});
  }, []);

  const handlePatchIssue = async (id, status) => {
    // in_progress → teknisyen seçim modalı
    if (status === 'in_progress') {
      const issue = issues.find(i => i.id === id);
      setTechModal({ id, issueTitle: issue?.title, stationName: issue?.station_name, chargerCode: issue?.charger_code });
      setSelectedTech('');
      return;
    }
    setPatchingId(id);
    try {
      await patchIssue(id, status);
      setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      setMsg(`Arıza durumu güncellendi → ${ISSUE_STATUS_STYLE[status]?.label || status}`);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setPatchingId(null); }
  };

  const handleAssignTechnician = async () => {
    if (!selectedTech || !techModal) return;
    setPatchingId(techModal.id);
    try {
      await patchIssue(techModal.id, 'in_progress', parseInt(selectedTech));
      setMsg(techModal.chargerCode
        ? `Teknisyen atandı, ${techModal.chargerCode} şarjcısı offline alındı ✓`
        : 'Teknisyen atandı, istasyon bakıma alındı ✓');
      setTechModal(null);
      setSelectedTech('');
      load();
    } catch (e) { setMsg(e.message); }
    finally { setPatchingId(null); }
  };

  const myStations     = stations.filter(s => String(s.operator_id) === String(user?.id));
  const allChargers    = myStations.flatMap(s => s.chargers || []);
  const totalChargers  = allChargers.length;
  const availableCount = allChargers.filter(c => c.status === 'available').length;
  const offlineCount   = allChargers.filter(c => c.status === 'offline').length;
  const occupiedCount  = allChargers.filter(c => c.status === 'occupied').length;

  const handleChargerStatus = async (chargerId, newStatus) => {
    try {
      await patchCharger(chargerId, newStatus);
      setMsg(`Şarjcı durumu güncellendi → ${CHARGER_STATUS_LABELS[newStatus] || newStatus}`);
      load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">İstasyonlarım</h2>
          <p className="text-slate-400 text-sm mt-0.5">{user?.name} · Operatör</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-sm bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg transition-colors">
          🔄 Yenile
        </button>
      </div>

      {/* Bildirim */}
      {msg && (
        <div className="bg-emerald-900/40 border border-emerald-700 rounded-xl px-4 py-3 text-emerald-300 text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-3 text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* İstatistik kartları */}
      {myStations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon="🏪" label="İstasyon"      value={myStations.length} />
          <StatCard icon="⚡" label="Toplam Şarjcı" value={totalChargers} />
          <StatCard icon="✅" label="Müsait"        value={availableCount} color="text-emerald-400" />
          <StatCard icon="🔴" label="Çevrimdışı"    value={offlineCount}   color="text-red-400" />
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div className="text-center py-12 text-slate-400 animate-pulse">Yükleniyor…</div>
      )}

      {/* Boş durum */}
      {!loading && myStations.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <p className="text-white font-semibold">Henüz atanmış istasyonunuz yok</p>
          <p className="text-slate-400 text-sm mt-1">Bir yönetici tarafından size istasyon atanacaktır.</p>
        </div>
      )}

      {/* İstasyon kartları */}
      {myStations.map(station => {
        const chargers = station.chargers || [];
        const avail    = chargers.filter(c => c.status === 'available').length;
        const occ      = chargers.filter(c => c.status === 'occupied').length;
        const off      = chargers.filter(c => c.status === 'offline').length;

        return (
          <div key={station.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
            {/* Başlık */}
            <div className="px-5 py-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold text-lg">{station.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[station.status] || 'bg-slate-700 text-slate-300'}`}>
                    {STATUS_LABELS[station.status] || station.status}
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-0.5 truncate">📍 {station.address}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-emerald-400">✓ {avail} müsait</span>
                  {occ > 0 && <span className="text-blue-400">● {occ} dolu</span>}
                  {off > 0 && <span className="text-red-400">✕ {off} çevrimdışı</span>}
                </div>
              </div>
              <button onClick={() => setEditing(station)}
                className="shrink-0 flex items-center gap-2 text-sm bg-slate-700 hover:bg-slate-600 text-emerald-400 font-medium px-4 py-2 rounded-xl transition-colors">
                ✏️ Düzenle
              </button>
            </div>

            {/* Şarjcılar */}
            <div className="p-4 space-y-2">
              {chargers.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">
                  Şarj ünitesi yok. "Düzenle" butonuyla ekleyebilirsiniz.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-3">
                    Şarj Üniteleri ({chargers.length})
                  </p>
                  {chargers.map(ch => (
                    <ChargerRow key={ch.id} ch={ch} onStatusChange={handleChargerStatus}/>
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}

      {/* Arıza Bildirimleri */}
      {issues.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
          <button
            onClick={() => setIssuesOpen(o => !o)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">🔧 Arıza Bildirimleri</span>
              <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-0.5 rounded-full">
                {issues.filter(i => i.status === 'open').length} açık
              </span>
              <span className="text-xs text-slate-400">({issues.length} toplam)</span>
            </div>
            <span className="text-slate-400 text-sm">{issuesOpen ? '▲' : '▼'}</span>
          </button>

          {issuesOpen && (
            <div className="border-t border-slate-700 divide-y divide-slate-700/60">
              {issues.map(issue => {
                const s = ISSUE_STATUS_STYLE[issue.status] || ISSUE_STATUS_STYLE.open;
                return (
                  <div key={issue.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{issue.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        📍 {issue.station_name}
                        {issue.charger_code && <span className="ml-2">⚡ {issue.charger_code}</span>}
                        {issue.reporter_name && <span className="ml-2">👤 {issue.reporter_name}</span>}
                      </p>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{issue.description}</p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {new Date(issue.created_at).toLocaleString('tr-TR')}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {issue.status === 'open' && (
                        <button
                          onClick={() => handlePatchIssue(issue.id, 'in_progress')}
                          disabled={patchingId === issue.id}
                          className="text-xs bg-yellow-900/50 hover:bg-yellow-900/80 border border-yellow-700 text-yellow-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {patchingId === issue.id ? '…' : '🔧 Devam Ediyor'}
                        </button>
                      )}
                      {issue.status === 'in_progress' && (
                        <button
                          onClick={() => handlePatchIssue(issue.id, 'resolved')}
                          disabled={patchingId === issue.id}
                          className="text-xs bg-emerald-900/50 hover:bg-emerald-900/80 border border-emerald-700 text-emerald-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {patchingId === issue.id ? '…' : '✅ Çözüldü'}
                        </button>
                      )}
                      {issue.status === 'resolved' && (
                        <span className="text-xs text-slate-500 italic py-1.5">Kapatıldı</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Teknisyen Seçim Modalı */}
      {techModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setTechModal(null); }}>
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">🔧 Teknisyen Ata</h3>
              <button onClick={() => setTechModal(null)} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-3">
                <p className="text-xs text-yellow-300 font-semibold">{techModal.stationName}</p>
                {techModal.chargerCode && (
                  <p className="text-xs text-orange-300 mt-0.5">⚡ Şarjcı: {techModal.chargerCode}</p>
                )}
                <p className="text-xs text-slate-300 mt-0.5">{techModal.issueTitle}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400">Teknisyen Seç *</label>
                <select
                  value={selectedTech}
                  onChange={e => setSelectedTech(e.target.value)}
                  className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Teknisyen seçin —</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500">
                {techModal.chargerCode
                  ? <>🔌 Seçilen teknisyene bildirim gönderilecek ve <span className="text-orange-400">{techModal.chargerCode}</span> şarjcısı offline alınacak.</>
                  : <>🏗 Seçilen teknisyene bildirim gönderilecek ve istasyon <span className="text-yellow-400">Bakımda</span> durumuna alınacak.</>
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleAssignTechnician}
                  disabled={patchingId !== null || !selectedTech}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-semibold"
                >
                  {patchingId !== null ? 'Atanıyor…' : techModal.chargerCode ? '🔧 Teknisyen Ata & Offline Al' : '🔧 Teknisyen Ata & Bakıma Al'}
                </button>
                <button onClick={() => setTechModal(null)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl text-sm">İptal</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Düzenleme modalı */}
      {editing && (
        <StationEditModal
          station={editing}
          isLoaded={isLoaded}
          onClose={() => setEditing(null)}
          onSaved={() => { setMsg('İstasyon güncellendi ✓'); load(); }}
        />
      )}
    </div>
  );
}
