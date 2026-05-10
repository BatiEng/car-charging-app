import { useState, useEffect } from 'react';
import { getStations, updateStation, patchCharger } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_COLOR = {
  available:   'text-emerald-400',
  occupied:    'text-blue-400',
  offline:     'text-red-400',
  active:      'text-emerald-400',
  inactive:    'text-slate-400',
  maintenance: 'text-orange-400',
};

export default function OperatorDashboard() {
  const { user } = useAuth();
  const [stations, setStations] = useState([]);
  const [editing, setEditing]   = useState(null);
  const [msg, setMsg]           = useState('');

  const load = () => getStations().then(setStations).catch(() => {});
  useEffect(() => { load(); }, []);

  // Filter to operator's own station(s)
  const myStations = stations.filter(s => String(s.operator_id) === String(user?.id));

  const handleStationSave = async () => {
    try {
      await updateStation(editing.id, { name: editing.name, address: editing.address, status: editing.status });
      setMsg('İstasyon güncellendi ✓');
      setEditing(null);
      load();
    } catch (e) { setMsg(e.message); }
  };

  const handleChargerStatus = async (chargerId, newStatus) => {
    try {
      await patchCharger(chargerId, newStatus);
      setMsg(`Şarjcı durumu güncellendi: ${newStatus}`);
      load();
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Operatör Paneli</h2>

      {msg && (
        <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg p-3 text-emerald-300 text-sm">
          {msg}
        </div>
      )}

      {myStations.length === 0 && (
        <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400">
          <p>Henüz atanmış istasyonunuz yok.</p>
          <p className="text-sm mt-1">Bir admin tarafından istasyonunuz atanacaktır.</p>
        </div>
      )}

      {myStations.map(station => (
        <div key={station.id} className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          {/* Station header */}
          <div className="px-5 py-4 border-b border-slate-700 flex items-start justify-between">
            <div>
              <h3 className="text-white font-semibold text-lg">{station.name}</h3>
              <p className="text-slate-400 text-sm mt-0.5">{station.address}</p>
              <p className={`text-sm mt-1 font-medium ${STATUS_COLOR[station.status] || 'text-slate-400'}`}>
                ● {station.status}
              </p>
            </div>
            <button
              onClick={() => setEditing({ ...station })}
              className="text-sm text-emerald-400 hover:underline"
            >
              Düzenle
            </button>
          </div>

          {/* Chargers */}
          <div className="p-4">
            <h4 className="text-slate-300 text-sm font-medium mb-3">Şarj Üniteleri</h4>
            <div className="space-y-3">
              {(station.chargers || []).map(ch => (
                <div key={ch.id} className="bg-slate-700/50 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white">{ch.charger_code}</span>
                      <span className={`text-xs font-medium ${STATUS_COLOR[ch.status] || ''}`}>● {ch.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {ch.type} · {ch.power} kW · {ch.connector_type} · {ch.price_per_kwh} TL/kWh
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {ch.status !== 'available' && (
                      <button
                        onClick={() => handleChargerStatus(ch.id, 'available')}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg"
                      >
                        Müsait Yap
                      </button>
                    )}
                    {ch.status !== 'offline' && (
                      <button
                        onClick={() => handleChargerStatus(ch.id, 'offline')}
                        className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg"
                      >
                        Çevrimdışı
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(!station.chargers || station.chargers.length === 0) && (
                <p className="text-slate-500 text-sm">Şarj ünitesi yok</p>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-96 space-y-4">
            <h3 className="text-white font-semibold">İstasyon Düzenle</h3>
            <div>
              <label className="text-xs text-slate-400">İstasyon Adı</label>
              <input
                value={editing.name}
                onChange={e => setEditing(ed => ({ ...ed, name: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Adres</label>
              <input
                value={editing.address}
                onChange={e => setEditing(ed => ({ ...ed, address: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">Durum</label>
              <select
                value={editing.status}
                onChange={e => setEditing(ed => ({ ...ed, status: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="maintenance">maintenance</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={handleStationSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-semibold">Kaydet</button>
              <button onClick={() => setEditing(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
