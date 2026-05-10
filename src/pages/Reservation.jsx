import { useState, useEffect } from 'react';
import { GoogleMap, DirectionsRenderer, MarkerF } from '@react-google-maps/api';
import { USER_LOCATION } from '../data/stations';
import { getMarkerIcon, getUserMarkerIcon, STATUS_COLOR, pad2, todayISO, tomorrowISO } from '../utils/helpers';
import { createReservation, cancelReservation, getReservations } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MAP_STYLE = { width: '100%', height: '220px', borderRadius: '12px', overflow: 'hidden' };

export default function Reservation({
  isLoaded,
  selectedStation, selectedVehicle,
  setView, setReservation,
}) {
  const { user, refreshUser } = useAuth();

  const [charger,    setCharger]    = useState(null);
  const [date,       setDate]       = useState(todayISO());
  const [duration,   setDuration]   = useState(1);
  const [slot,       setSlot]       = useState(null);
  const [confirmed,  setConfirmed]  = useState(false);
  const [resData,    setResData]    = useState(null);
  const [directions, setDirections] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Existing reservations to check for taken slots
  const [takenSlots, setTakenSlots] = useState([]);

  useEffect(() => {
    if (!selectedStation || !charger) return;
    getReservations()
      .then(rows => {
        const taken = rows
          .filter(r => r.charger_id == charger.id && r.reservation_date === date && ['pending','active'].includes(r.status))
          .map(r => r.start_time.slice(0, 5));
        setTakenSlots(taken);
      })
      .catch(() => {});
  }, [charger, date, selectedStation]);

  // Load route when confirmed
  useEffect(() => {
    if (!isLoaded || !confirmed || !resData) return;
    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin:      USER_LOCATION,
        destination: { lat: parseFloat(resData.lat || resData.station?.lat), lng: parseFloat(resData.lng || resData.station?.lng) },
        travelMode:  window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => { if (status === 'OK') setDirections(result); }
    );
  }, [isLoaded, confirmed, resData]);

  if (!selectedStation || !selectedVehicle) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-sm p-14">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-semibold text-white mb-2">Hiçbir Şey Seçilmedi</h2>
          <p className="text-slate-400 text-sm mb-6">
            Önce bir araç kaydedin ve haritadan bir istasyon seçin.
          </p>
          <button onClick={() => setView('vehicles')}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-500 text-sm font-semibold mr-3 transition-colors">
            Araçlarım
          </button>
          <button onClick={() => setView('map')}
            className="bg-slate-700 text-slate-200 px-6 py-2.5 rounded-xl hover:bg-slate-600 text-sm font-semibold transition-colors">
            İstasyon Bul
          </button>
        </div>
      </div>
    );
  }

  // Compatible chargers: connector match + not offline
  const compatChargers = (selectedStation.chargers || []).filter(
    (c) => c.connector_type === (selectedVehicle.connector_type || selectedVehicle.connector) && c.status !== 'offline'
  );

  const getSlots = () => {
    const out = [];
    for (let h = 8; h <= 21; h++) {
      if (h + duration > 22) continue;
      const t = `${pad2(h)}:00`;
      const taken = takenSlots.includes(t);
      out.push({ time: t, endTime: `${pad2(h + duration)}:00`, taken });
    }
    return out;
  };

  const estCost = charger
    ? (charger.power * duration * (charger.price_per_kwh || charger.price || 3.5)).toFixed(2)
    : '–';

  const handleConfirm = async () => {
    setError(''); setLoading(true);
    try {
      const res = await createReservation({
        vehicle_id: selectedVehicle.id,
        charger_id: charger.id,
        date,
        start_time: slot,
        duration,
      });
      setResData(res);
      setReservation(res);
      setConfirmed(true);
      refreshUser(); // update wallet balance in header
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Confirmed Screen ─── */
  if (confirmed && resData) {
    const stLat = parseFloat(resData.lat || selectedStation.lat);
    const stLng = parseFloat(resData.lng || selectedStation.lng);

    return (
      <div className="p-4 sm:p-8 max-w-2xl mx-auto">
        <div className="bg-slate-800 rounded-2xl border border-emerald-700 p-5 sm:p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-emerald-900/50 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
              ✅
            </div>
            <h2 className="text-2xl font-bold text-white">Rezervasyon Onaylandı!</h2>
            <p className="text-slate-400 text-sm mt-1">Şarj slotunuz rezerve edildi.</p>
          </div>

          {/* Summary */}
          <div className="bg-slate-700/50 rounded-xl p-5 space-y-2.5 text-sm mb-5">
            {[
              ['İstasyon',    resData.station_name || selectedStation.name],
              ['Şarjcı Kodu', resData.charger_code],
              ['Konektör',    resData.connector_type, '✓ Uyumlu'],
              ['Araç',        `${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.plate})`],
              ['Tarih',       resData.reservation_date || date],
              ['Saat',        `${resData.start_time?.slice(0,5) || slot} – ${resData.end_time?.slice(0,5) || ''} (${duration}s)`],
            ].map(([k, v, suffix]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-200">{v} {suffix && <span className="text-emerald-400">{suffix}</span>}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-600 pt-2.5">
              <span className="font-semibold text-white">Kesilen Tutar</span>
              <span className="font-bold text-emerald-400 text-lg">
                {parseFloat(resData.amount_deducted || resData.estimated_cost || estCost).toFixed(2)} TL
              </span>
            </div>
            {resData.wallet_balance !== undefined && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Kalan Bakiye</span>
                <span>{parseFloat(resData.wallet_balance).toFixed(2)} TL</span>
              </div>
            )}
          </div>

          {/* Route Map */}
          <div className="mb-5">
            <p className="text-sm font-semibold text-slate-300 mb-2">🗺️ İstasyona Yol</p>
            {isLoaded ? (
              <GoogleMap mapContainerStyle={MAP_STYLE} center={USER_LOCATION} zoom={12}>
                <MarkerF position={USER_LOCATION} icon={getUserMarkerIcon()} title="Konumunuz" />
                <MarkerF
                  position={{ lat: stLat, lng: stLng }}
                  icon={getMarkerIcon(STATUS_COLOR.available)}
                  title={resData.station_name}
                />
                {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: true }} />}
              </GoogleMap>
            ) : (
              <div className="h-[220px] bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 text-sm">
                Harita yükleniyor…
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setView('session')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-colors text-sm"
            >
              ⚡ Şarj Sayfasına Git
            </button>
            <button
              onClick={() => setView('map')}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Haritaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─── Booking Form ─── */
  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Rezervasyon Yap</h1>
        <p className="text-slate-400 mt-1 text-sm">{selectedStation.name} istasyonunda slot rezerve et</p>
      </div>

      {/* Wallet balance warning */}
      {user && parseFloat(user.wallet_balance) < 50 && (
        <div className="mb-4 bg-yellow-900/40 border border-yellow-700 rounded-xl p-3 text-yellow-300 text-sm flex items-center gap-2">
          ⚠️ Düşük bakiye ({parseFloat(user.wallet_balance).toFixed(2)} TL). Rezervasyon için
          <button onClick={() => setView('wallet')} className="underline font-semibold">cüzdanı doldurun</button>.
        </div>
      )}

      {/* Context cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">İstasyon</p>
          <p className="font-semibold text-white">{selectedStation.name}</p>
          <p className="text-sm text-slate-400">{selectedStation.address}</p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <p className="text-xs text-slate-400 uppercase tracking-wide font-semibold mb-1">Araç</p>
          <p className="font-semibold text-white">{selectedVehicle.brand} {selectedVehicle.model}</p>
          <p className="text-sm text-slate-400">{selectedVehicle.plate}</p>
          <p className="text-xs text-slate-500 mt-1">
            🔌 {selectedVehicle.connector_type || selectedVehicle.connector} · 🔋 {selectedVehicle.battery_kwh || selectedVehicle.battery} kWh
          </p>
        </div>
      </div>

      {/* Step 1 – Charger */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 sm:p-6 mb-4">
        <p className="font-semibold text-white mb-0.5">Adım 1 — Şarjcı Seç</p>
        <p className="text-xs text-slate-400 mb-4">
          Sadece aracınızla uyumlu ({selectedVehicle.connector_type || selectedVehicle.connector}) şarjcılar gösteriliyor
        </p>

        {compatChargers.length === 0 ? (
          <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-xl p-4 text-sm">
            ❌ Bu istasyonda <strong>{selectedVehicle.connector_type || selectedVehicle.connector}</strong> uyumlu şarjcı yok.
            Başka bir istasyon seçin.
          </div>
        ) : (
          <div className="space-y-2">
            {compatChargers.map((c) => (
              <div
                key={c.id}
                onClick={() => { setCharger(c); setSlot(null); }}
                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  charger?.id === c.id
                    ? 'border-emerald-500 bg-emerald-900/20'
                    : 'border-slate-700 hover:border-emerald-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: STATUS_COLOR[c.status] || '#6b7280' }}
                  />
                  <div>
                    <p className="font-mono font-semibold text-sm text-white">{c.charger_code}</p>
                    <p className="text-xs text-slate-400">{c.type} · {c.power} kW · {c.connector_type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-200">{c.price_per_kwh || c.price} TL/kWh</p>
                  <p className={`text-xs ${c.status === 'available' ? 'text-emerald-400' : 'text-yellow-400'}`}>
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
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 sm:p-6 mb-4">
          <p className="font-semibold text-white mb-4">Adım 2 — Tarih & Saat Seç</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Tarih</label>
              <input
                type="date" min={todayISO()} max={tomorrowISO()} value={date}
                onChange={(e) => { setDate(e.target.value); setSlot(null); }}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-yellow-500 mt-1">⚠️ Maks. 24 saat önceden rezervasyon</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Süre</label>
              <select
                value={duration}
                onChange={(e) => { setDuration(+e.target.value); setSlot(null); }}
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={1}>1 Saat</option>
                <option value={2}>2 Saat (maksimum)</option>
              </select>
              <p className="text-xs text-yellow-500 mt-1">⚠️ Seans başına maks. 2 saat</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
              Başlangıç Saati
            </label>
            <input
              type="time"
              value={slot || ''}
              onChange={(e) => setSlot(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">Saat:dakika formatında girin — test için yakın bir saat seçin</p>
          </div>
        </div>
      )}

      {/* Summary & Confirm */}
      {charger && slot && (
        <div className="bg-slate-800 rounded-2xl border border-emerald-700 p-6">
          <p className="font-semibold text-white mb-4">Rezervasyon Özeti</p>
          <div className="space-y-2 text-sm mb-5">
            {[
              ['Şarjcı',         `${charger.charger_code} · ${charger.type} ${charger.power}kW`],
              ['Tarih',          date],
              ['Saat Slotu',     `${slot} – ${pad2(+slot.split(':')[0] + duration)}:00`],
              ['Süre',           `${duration} saat`],
              ['Max Enerji',     `${charger.power * duration} kWh`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-200">{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-600 pt-2">
              <span className="font-semibold text-white">Tahmini Tutar</span>
              <span className="font-bold text-emerald-400 text-lg">~{estCost} TL</span>
            </div>
          </div>

          <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-300 text-xs rounded-lg p-3 mb-4 flex gap-2 items-center">
            ✅ <strong>{charger.connector_type}</strong> konektörü {selectedVehicle.brand} {selectedVehicle.model} ile uyumlu
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Onaylanıyor...' : 'Rezervasyonu Onayla'}
          </button>
          <p className="text-xs text-slate-500 mt-2 text-center">
            {estCost} TL cüzdanınızdan kesilecek (fazlası şarj sonunda iade edilir)
          </p>
        </div>
      )}
    </div>
  );
}
