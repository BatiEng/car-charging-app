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
  available:   'bg-blue-900/40 text-blue-300 border border-blue-800',
  occupied:    'bg-blue-900/40 text-blue-300 border border-blue-800',
  offline:     'bg-red-900/40 text-red-300 border border-red-800',
  active:      'bg-blue-900/40 text-blue-300 border border-blue-800',
  inactive:    'bg-gray-100 text-gray-700 border border-gray-300',
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
const STATUS_LABELS         = { active:' Active', inactive:' Inactive', maintenance:' Under Maintenance' };
const CHARGER_STATUS_LABELS = { available:'Available', occupied:'Occupied', offline:'Offline' };
const STATION_STATUSES      = ['active', 'inactive', 'maintenance'];
const MINI_MAP_STYLE        = { width:'100%', height:'260px' };
const MINI_MAP_OPTIONS      = { disableDefaultUI:true, clickableIcons:false };
const EMPTY_CHARGER         = { charger_code:'', type:'AC', power:'', connector_type:'', price_per_kwh:'3.50' };

//  ChargerList 
function ChargerList({ chargers, onChange, onDelete }) {
  const update = (idx, field, val) =>
    onChange(chargers.map((c, i) => i === idx ? { ...c, [field]: val } : c));

  return (
    <div className="space-y-3">
      {chargers.map((ch, idx) => (
        <div key={ch.id ?? `new-${idx}`}
          className="bg-gray-50 border border-gray-300 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              {ch._new ? `New Charger #${idx + 1}` : `Charger #${idx + 1} (ID: ${ch.id})`}
            </span>
            <button type="button" onClick={() => onDelete(idx, ch)}
              className="text-xs text-red-400 hover:text-red-300"> Remove</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400">Code *</label>
              <input value={ch.charger_code}
                onChange={e => update(idx, 'charger_code', e.target.value.toUpperCase())}
                placeholder="e.g. ST1-01"
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"/>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Type</label>
              <select value={ch.type} onChange={e => update(idx, 'type', e.target.value)}
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs">
                <option value="AC">AC</option>
                <option value="DC">DC</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Power (kW) *</label>
              <input type="number" min="1" value={ch.power}
                onChange={e => update(idx, 'power', e.target.value)}
                placeholder="22"
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"/>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">TL/kWh</label>
              <input type="number" min="0" step="0.01" value={ch.price_per_kwh}
                onChange={e => update(idx, 'price_per_kwh', e.target.value)}
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"/>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-400">Connector *</label>
            <select value={ch.connector_type} onChange={e => update(idx, 'connector_type', e.target.value)}
              className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs">
              <option value="">Select…</option>
              {CONNECTORS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

//  Station Edit Modal 
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
    if (!form.name || !form.address) { setErr('Name and address are required'); return; }
    if (!form.lat  || !form.lng)     { setErr('Select a location on the map'); return; }
    const filled = chargers.filter(c => c.charger_code || c.power || c.connector_type);
    for (const c of filled) {
      if (!c.charger_code || !c.power || !c.connector_type) { setErr('Fill in all charger fields'); return; }
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
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900">Edit Station</h3>
            <p className="text-gray-500 text-xs mt-0.5">{station.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none"></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[85vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
              <div>
                <label className="text-xs text-gray-500">Station Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="text-xs text-gray-500">Address *</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div>
                <label className="text-xs text-gray-500">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm">
                  {STATION_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Latitude</label>
                  <input readOnly value={form.lat ?? ''} placeholder="Select on map"
                    className="w-full mt-1 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm cursor-not-allowed"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Longitude</label>
                  <input readOnly value={form.lng ?? ''} placeholder="Select on map"
                    className="w-full mt-1 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm cursor-not-allowed"/>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide"> Charging Units</p>
                  <button type="button" onClick={handleAddCharger}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-blue-400 px-2 py-1 rounded-lg">+ Add</button>
                </div>
                <ChargerList chargers={chargers} onChange={setChargers} onDelete={handleDeleteCharger}/>
                {chargers.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3">No chargers. Use "+ Add" to add one.</p>
                )}
              </div>
              {err && <p className="text-red-400 text-sm">{err}</p>}
              <button onClick={handleSave} disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
                {saving ? 'Saving…' : ' Save Changes'}
              </button>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2"> Click on the map to update location</p>
              {!isLoaded ? (
                <div className="flex items-center justify-center bg-gray-100 rounded-xl h-64">
                  <p className="text-gray-500 text-sm animate-pulse">Loading map…</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden border border-gray-300">
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
                <p className="text-xs text-blue-400 mt-2"> {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

//  Stat Card 
function StatCard({ icon, label, value, color = 'text-white' }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
      <div className="text-2xl">{icon}</div>
      <div>
        <p className="text-gray-500 text-xs">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}

//  Charger Row 
function ChargerRow({ ch, onStatusChange }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-gray-100/40 border border-gray-200 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_DOT[ch.status] || '#64748b' }}/>
        <span className="font-mono text-sm text-gray-900">{ch.charger_code}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[ch.status] || 'bg-gray-100 text-gray-700'}`}>
          {CHARGER_STATUS_LABELS[ch.status] ?? ch.status}
        </span>
      </div>
      <p className="text-xs text-gray-500 shrink-0">
        {ch.type} · {ch.power} kW · {ch.connector_type} · {ch.price_per_kwh} TL/kWh
      </p>
      <div className="flex gap-2 shrink-0">
        {ch.status !== 'available' && (
          <button onClick={() => onStatusChange(ch.id, 'available')}
            className="text-xs bg-blue-800 hover:bg-blue-700 text-blue-200 px-3 py-1.5 rounded-lg transition-colors"> Available</button>
        )}
        {ch.status !== 'offline' && (
          <button onClick={() => onStatusChange(ch.id, 'offline')}
            className="text-xs bg-red-900 hover:bg-red-800 text-red-200 px-3 py-1.5 rounded-lg transition-colors">Offline</button>
        )}
        {ch.status !== 'occupied' && (
          <button onClick={() => onStatusChange(ch.id, 'occupied')}
            className="text-xs bg-blue-900 hover:bg-blue-800 text-blue-200 px-3 py-1.5 rounded-lg transition-colors">Occupied</button>
        )}
      </div>
    </div>
  );
}

const ISSUE_STATUS_STYLE = {
  open:        { badge: 'bg-red-900/40 text-red-300 border border-red-800',        label: ' Open' },
  in_progress: { badge: 'bg-yellow-900/40 text-yellow-300 border border-yellow-800', label: ' In Progress' },
  resolved:    { badge: 'bg-blue-900/40 text-blue-300 border border-blue-800', label: ' Resolved' },
};

//  Main 
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
  const [maintStart,    setMaintStart]    = useState('');
  const [maintEnd,      setMaintEnd]      = useState('');

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
      const now = new Date(); now.setSeconds(0, 0);
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const fmt = d => d.toISOString().slice(0, 16);
      setMaintStart(fmt(now));
      setMaintEnd(fmt(end));
      setTechModal({ id, issueTitle: issue?.title, stationName: issue?.station_name, chargerCode: issue?.charger_code });
      setSelectedTech('');
      return;
    }
    setPatchingId(id);
    try {
      await patchIssue(id, status);
      setIssues(prev => prev.map(i => i.id === id ? { ...i, status } : i));
      setMsg(`Issue status updated → ${ISSUE_STATUS_STYLE[status]?.label || status}`);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setPatchingId(null); }
  };

  const handleAssignTechnician = async () => {
    if (!selectedTech || !techModal) return;
    setPatchingId(techModal.id);
    try {
      const res = await patchIssue(techModal.id, 'in_progress', parseInt(selectedTech), maintStart, maintEnd);
      const cancelledText = res.cancelled_count > 0 ? ` ${res.cancelled_count} reservation(s) cancelled, refunds issued.` : '';
      setMsg(techModal.chargerCode
        ? `Technician assigned, ${techModal.chargerCode} charger taken offline ${cancelledText}`
        : `Technician assigned, station set to maintenance ${cancelledText}`);
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
      setMsg(`Charger status updated → ${CHARGER_STATUS_LABELS[newStatus] || newStatus}`);
      load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Stations</h2>
          <p className="text-gray-500 text-sm mt-0.5">{user?.name} · Operator</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-1.5 text-sm bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg transition-colors">
           Refresh
        </button>
      </div>

      {/* Bildirim */}
      {msg && (
        <div className="bg-blue-900/40 border border-blue-700 rounded-xl px-4 py-3 text-blue-300 text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="ml-3 text-blue-400 hover:text-white"></button>
        </div>
      )}

      {/* İstatistik kartları */}
      {myStations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon="" label="Stations"      value={myStations.length} />
          <StatCard icon="" label="Total Chargers" value={totalChargers} />
          <StatCard icon="" label="Available"     value={availableCount} color="text-blue-400" />
          <StatCard icon="" label="Offline"       value={offlineCount}   color="text-red-400" />
        </div>
      )}

      {/* Yükleniyor */}
      {loading && (
        <div className="text-center py-12 text-gray-500 animate-pulse">Loading…</div>
      )}

      {/* Boş durum */}
      {!loading && myStations.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
          <div className="text-5xl mb-4"></div>
          <p className="text-gray-900 font-semibold">No stations assigned yet</p>
          <p className="text-gray-500 text-sm mt-1">An admin will assign a station to you.</p>
        </div>
      )}

      {/* İstasyon kartları */}
      {myStations.map(station => {
        const chargers = station.chargers || [];
        const avail    = chargers.filter(c => c.status === 'available').length;
        const occ      = chargers.filter(c => c.status === 'occupied').length;
        const off      = chargers.filter(c => c.status === 'offline').length;

        return (
          <div key={station.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Başlık */}
            <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-gray-900 font-semibold text-lg">{station.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[station.status] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[station.status] || station.status}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-0.5 truncate"> {station.address}</p>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-blue-400"> {avail} available</span>
                  {occ > 0 && <span className="text-blue-400"> {occ} occupied</span>}
                  {off > 0 && <span className="text-red-400"> {off} offline</span>}
                </div>
              </div>
              <button onClick={() => setEditing(station)}
                className="shrink-0 flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-blue-400 font-medium px-4 py-2 rounded-xl transition-colors">
                 Edit
              </button>
            </div>

            {/* Şarjcılar */}
            <div className="p-4 space-y-2">
              {chargers.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  No charging units. You can add them with the "Edit" button.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">
                    Charging Units ({chargers.length})
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
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setIssuesOpen(o => !o)}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-100/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-900 font-semibold"> Issue Reports</span>
              <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-0.5 rounded-full">
                {issues.filter(i => i.status === 'open').length} open
              </span>
              <span className="text-xs text-gray-500">({issues.length} total)</span>
            </div>
            <span className="text-gray-500 text-sm">{issuesOpen ? '' : ''}</span>
          </button>

          {issuesOpen && (
            <div className="border-t border-gray-200 divide-y divide-gray-200/60">
              {issues.map(issue => {
                const s = ISSUE_STATUS_STYLE[issue.status] || ISSUE_STATUS_STYLE.open;
                return (
                  <div key={issue.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{issue.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>{s.label}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                         {issue.station_name}
                        {issue.charger_code && <span className="ml-2"> {issue.charger_code}</span>}
                        {issue.reporter_name && <span className="ml-2"> {issue.reporter_name}</span>}
                      </p>
                      <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">{issue.description}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
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
                          {patchingId === issue.id ? '…' : ' In Progress'}
                        </button>
                      )}
                      {issue.status === 'in_progress' && (
                        <button
                          onClick={() => handlePatchIssue(issue.id, 'resolved')}
                          disabled={patchingId === issue.id}
                          className="text-xs bg-blue-900/50 hover:bg-blue-900/80 border border-blue-700 text-blue-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                        >
                          {patchingId === issue.id ? '…' : ' Resolved'}
                        </button>
                      )}
                      {issue.status === 'resolved' && (
                        <span className="text-xs text-gray-400 italic py-1.5">Closed</span>
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
          <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900"> Assign Technician & Schedule Maintenance</h3>
              <button onClick={() => setTechModal(null)} className="text-gray-500 hover:text-white text-xl leading-none"></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-3">
                <p className="text-xs text-yellow-300 font-semibold">{techModal.stationName}</p>
                {techModal.chargerCode && (
                  <p className="text-xs text-orange-300 mt-0.5"> Charger: {techModal.chargerCode}</p>
                )}
                <p className="text-xs text-gray-700 mt-0.5">{techModal.issueTitle}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Select Technician *</label>
                <select
                  value={selectedTech}
                  onChange={e => setSelectedTech(e.target.value)}
                  className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">— Select technician —</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
              <div className="bg-gray-50 border border-gray-300 rounded-xl p-3 space-y-3">
                <p className="text-xs text-gray-700 font-medium"> Maintenance Time Window</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Start</label>
                    <input
                      type="datetime-local"
                      value={maintStart}
                      onChange={e => setMaintStart(e.target.value)}
                      className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Estimated End</label>
                    <input
                      type="datetime-local"
                      value={maintEnd}
                      onChange={e => setMaintEnd(e.target.value)}
                      className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-amber-400">
                   All reservations in this window will be cancelled and users will receive automatic refunds + notifications.
                </p>
              </div>
              <p className="text-xs text-gray-400">
                {techModal.chargerCode
                  ? <> The selected technician will be notified and <span className="text-orange-400">{techModal.chargerCode}</span> charger will be taken offline.</>
                  : <> The selected technician will be notified and the station will be set to <span className="text-yellow-400">Under Maintenance</span> status.</>
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleAssignTechnician}
                  disabled={patchingId !== null || !selectedTech || !maintStart || !maintEnd}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-semibold"
                >
                  {patchingId !== null ? 'Assigning…' : techModal.chargerCode ? ' Assign Technician & Take Offline' : ' Assign Technician & Set Maintenance'}
                </button>
                <button onClick={() => setTechModal(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-white py-2 rounded-xl text-sm">Cancel</button>
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
          onSaved={() => { setMsg('Station updated '); load(); }}
        />
      )}
    </div>
  );
}
