import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { MAP_CENTER } from '../constants';
import { getMarkerIcon, getUserMarkerIcon, STATUS_COLOR, STATUS_BADGE } from '../utils/helpers';
import { getStations, getMyTopStation, getMyFavorites, addFavorite, removeFavorite, reportIssue, getMyQueue, joinQueue, leaveQueue } from '../services/api';

const MAP_STYLE   = { width: '100%', height: '100%' };
const MAP_OPTIONS = {
  disableDefaultUI: false,
  clickableIcons: false,
  styles: [
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  ],
};

function getStationStatus(station) {
  if (station.status === 'maintenance') return 'maintenance';
  if (station.status === 'inactive')    return 'inactive';
  if (!station.chargers || station.chargers.length === 0) return 'offline';
  if (station.chargers.some(c => c.status === 'available')) return 'available';
  if (station.chargers.every(c => c.status === 'offline'))  return 'offline';
  return 'occupied';
}

//  Sorun Bildirme Modal'ı 
function IssueModal({ station, onClose }) {
  const [form,    setForm]    = useState({ title: '', description: '', charger_id: '' });
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [success, setSuccess] = useState(false);

  const chargers = station.chargers || [];

  const handleSubmit = async () => {
    if (!form.title.trim())       { setErr('Başlık gerekli'); return; }
    if (!form.description.trim()) { setErr('Açıklama gerekli'); return; }
    setSaving(true); setErr('');
    try {
      await reportIssue({
        station_id:  station.id,
        charger_id:  form.charger_id || undefined,
        title:       form.title.trim(),
        description: form.description.trim(),
      });
      setSuccess(true);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="font-semibold text-gray-900"> Sorun Bildir</h3>
            <p className="text-xs text-gray-500 mt-0.5">{station.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none"></button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-3"></div>
              <p className="text-gray-900 font-semibold">Bildiriminiz alındı</p>
              <p className="text-gray-500 text-sm mt-1">İstasyon operatörüne iletildi, en kısa sürede incelenecek.</p>
              <button
                onClick={onClose}
                className="mt-5 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl text-sm font-semibold"
              >Kapat</button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Şarjcı seç (opsiyonel) */}
              {chargers.length > 0 && (
                <div>
                  <label className="text-xs text-gray-500">Şarj Ünitesi (opsiyonel)</label>
                  <select
                    value={form.charger_id}
                    onChange={e => setForm(f => ({ ...f, charger_id: e.target.value }))}
                    className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">— Genel istasyon sorunu —</option>
                    {chargers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.charger_code ? `${c.charger_code} · ` : ''}{c.type} {c.power}kW · {c.connector_type}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Başlık */}
              <div>
                <label className="text-xs text-gray-500">Başlık *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  maxLength={120}
                  placeholder="örn. Şarjcı bağlantı vermiyor"
                  className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm placeholder-slate-500"
                />
              </div>

              {/* Açıklama */}
              <div>
                <label className="text-xs text-gray-500">Açıklama *</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder="Sorunu detaylı açıklayın…"
                  className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm resize-none placeholder-slate-500"
                />
              </div>

              {err && <p className="text-red-400 text-sm">{err}</p>}

              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold"
                >
                  {saving ? 'Gönderiliyor…' : ' Bildirimi Gönder'}
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-white py-2.5 rounded-xl text-sm"
                >İptal</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Haversine mesafesi (km) */
function distanceKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(sin2), Math.sqrt(1 - sin2));
}

export default function StationMap({ isLoaded, selectedStation, setSelectedStation, selectedVehicle, setView, user, readOnly = false }) {
  const mapRef = useRef(null);

  const [stations,     setStations]     = useState([]);
  const [filterConn,   setFilterConn]   = useState(
    () => selectedVehicle?.connector_type || selectedVehicle?.connector || 'all'
  );
  const [filterPow,    setFilterPow]    = useState('all');
  const [infoStation,  setInfoStation]  = useState(null);
  const [routeInfo,    setRouteInfo]    = useState(null); // { distance, duration, stationName }

  // Kullanıcı konumu (varsayılan: İzmir merkezi)
  const [userLocation, setUserLocation] = useState(MAP_CENTER);
  const [locReady,     setLocReady]     = useState(false);

  // Yakın istasyon yoksa öneri banner'ı
  const [nearbyPrompt, setNearbyPrompt]         = useState(null); // { station, dist }
  const [promptDismissed, setPromptDismissed]   = useState(false);

  // En çok kullanılan istasyon
  const [topStation, setTopStation] = useState(null);

  // Favoriler
  const [favoriteIds,    setFavoriteIds]    = useState(new Set());
  const [favLoading,     setFavLoading]     = useState(null); // station_id yükleniyor
  const [showFavOnly,    setShowFavOnly]    = useState(false);

  // Sorun bildirme
  const [issueStation, setIssueStation] = useState(null);

  // Bekleme kuyruğu
  const [myQueueEntries, setMyQueueEntries] = useState([]);
  const [queueLoading,   setQueueLoading]   = useState(false);

  //  Konum izni 
  useEffect(() => {
    if (!navigator.geolocation) { setLocReady(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLocReady(true);
        // Haritayı kullanıcı konumuna ortala
        mapRef.current?.panTo(loc);
        mapRef.current?.setZoom(12);
      },
      () => setLocReady(true),
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  //  İstasyon verisi 
  useEffect(() => {
    const load = () => getStations().then(setStations).catch(() => {});
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  //  En çok kullanılan istasyon (sadece driver) 
  useEffect(() => {
    if (user?.role === 'driver') {
      getMyTopStation().then(setTopStation).catch(() => {});
    }
  }, [user]);

  //  Favoriler (sadece driver) 
  const loadFavorites = () => {
    if (user?.role === 'driver') {
      getMyFavorites()
        .then(rows => setFavoriteIds(new Set(rows.map(r => r.id))))
        .catch(() => {});
    }
  };
  useEffect(() => { loadFavorites(); }, [user]);

  const handleToggleFavorite = async (e, stationId) => {
    e.stopPropagation();
    if (favLoading === stationId) return;
    setFavLoading(stationId);
    try {
      if (favoriteIds.has(stationId)) {
        await removeFavorite(stationId);
        setFavoriteIds(prev => { const s = new Set(prev); s.delete(stationId); return s; });
      } else {
        await addFavorite(stationId);
        setFavoriteIds(prev => new Set([...prev, stationId]));
      }
    } catch {}
    finally { setFavLoading(null); }
  };

  //  Bekleme Kuyruğu 
  const loadQueue = () => {
    if (user?.role === 'driver') {
      getMyQueue().then(rows => setMyQueueEntries(rows)).catch(() => {});
    }
  };
  useEffect(() => { loadQueue(); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoinQueue = async (stationId, connectorType) => {
    setQueueLoading(true);
    try {
      await joinQueue(stationId, connectorType);
      await loadQueue();
    } catch (e) {
      alert(e.message);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleLeaveQueue = async (stationId) => {
    setQueueLoading(true);
    try {
      await leaveQueue(stationId);
      await loadQueue();
    } catch (e) {
      alert(e.message);
    } finally {
      setQueueLoading(false);
    }
  };

  //  Yakın istasyon yoksa öner 
  useEffect(() => {
    if (!locReady || stations.length === 0 || promptDismissed) return;

    const visible = user?.role === 'operator'
      ? stations.filter(s => String(s.operator_id) === String(user.id))
      : stations;

    const RADIUS_KM = 50;
    const nearby = visible.filter(s =>
      distanceKm(userLocation, { lat: parseFloat(s.lat), lng: parseFloat(s.lng) }) <= RADIUS_KM
    );

    if (nearby.length === 0 && visible.length > 0) {
      // En yakın istasyonu bul
      const sorted = [...visible].sort((a, b) =>
        distanceKm(userLocation, { lat: parseFloat(a.lat), lng: parseFloat(a.lng) }) -
        distanceKm(userLocation, { lat: parseFloat(b.lat), lng: parseFloat(b.lng) })
      );
      const nearest = sorted[0];
      const dist = distanceKm(userLocation, { lat: parseFloat(nearest.lat), lng: parseFloat(nearest.lng) });
      setNearbyPrompt({ station: nearest, dist: Math.round(dist) });
    }
  }, [locReady, stations, userLocation, promptDismissed, user]);

  //  Araç değişince connector filtresi 
  useEffect(() => {
    const conn = selectedVehicle?.connector_type || selectedVehicle?.connector;
    setFilterConn(conn || 'all');
  }, [selectedVehicle]);

  const onMapLoad = useCallback((map) => { mapRef.current = map; }, []);

  // Operator ise sadece kendi istasyonları
  const visibleStations = user?.role === 'operator'
    ? stations.filter(s => String(s.operator_id) === String(user.id))
    : stations;

  const filtered = visibleStations.filter((s) => {
    const okConn = filterConn === 'all' || (s.chargers || []).some(c => c.connector_type === filterConn);
    const okPow  = filterPow  === 'all' || (s.chargers || []).some((c) => {
      if (filterPow === 'slow')  return c.power <= 22;
      if (filterPow === 'fast')  return c.power >= 50 && c.power < 150;
      if (filterPow === 'rapid') return c.power >= 150;
      return true;
    });
    const okFav  = !showFavOnly || favoriteIds.has(s.id);
    return okConn && okPow && okFav;
  });

  const handleMarkerClick = (station) => {
    setInfoStation(station);
    setSelectedStation(station);
    setRouteInfo(null);
    mapRef.current?.panTo({ lat: parseFloat(station.lat), lng: parseFloat(station.lng) });
  };

  const handleShowRoute = (station) => {
    const target = station || infoStation;
    if (!target) return;
    const lat = parseFloat(target.lat);
    const lng = parseFloat(target.lng);
    // Google Maps'i yeni sekmede yol tarifi moduyla aç
    const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const handleStationSelect = (station) => {
    setSelectedStation(station);
    setInfoStation(station);
    mapRef.current?.panTo({ lat: parseFloat(station.lat), lng: parseFloat(station.lng) });
    mapRef.current?.setZoom(14);
  };

  const handleGoNearest = () => {
    if (!nearbyPrompt) return;
    const { station } = nearbyPrompt;
    mapRef.current?.panTo({ lat: parseFloat(station.lat), lng: parseFloat(station.lng) });
    mapRef.current?.setZoom(13);
    setPromptDismissed(true);
    setNearbyPrompt(null);
  };

  const connectorTypes = [...new Set(
    visibleStations.flatMap(s => (s.chargers || []).map(c => c.connector_type))
  )].filter(Boolean);

  const STATUS_LABEL = { available: 'Müsait', occupied: 'Dolu', offline: 'Çevrimdışı', maintenance: ' Bakımda', inactive: 'Pasif' };

  return (
    <div className="flex flex-col h-full">

      {/*  Sorun bildirme modal'ı  */}
      {issueStation && (
        <IssueModal
          station={issueStation}
          onClose={() => setIssueStation(null)}
        />
      )}

      {/*  Yakın istasyon yoksa banner  */}
      {nearbyPrompt && !promptDismissed && (
        <div className="bg-amber-900/70 border-b border-amber-700 px-4 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-sm text-amber-200 flex-1">
             Konumunuza yakın ({nearbyPrompt.dist} km içinde) istasyon bulunamadı.
            En yakın istasyon: <strong>{nearbyPrompt.station.name}</strong> (~{nearbyPrompt.dist} km uzakta).
            Oraya gitmek ister misiniz?
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleGoNearest}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              Evet, götür
            </button>
            <button
              onClick={() => { setPromptDismissed(true); setNearbyPrompt(null); }}
              className="bg-amber-900/60 hover:bg-amber-800 text-amber-300 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/*  Filter Bar  */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-gray-500 hidden sm:inline">Filtreler:</span>
        {selectedVehicle && !readOnly && (
          <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded-lg">
             {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.connector_type || selectedVehicle.connector}
          </span>
        )}
        {readOnly && (
          <span className="text-xs bg-gray-100 border border-gray-300 text-gray-500 px-2 py-1 rounded-lg">
             Görüntüleme modu
          </span>
        )}

        <select value={filterConn} onChange={e => setFilterConn(e.target.value)}
          className="text-xs sm:text-sm bg-white border border-gray-300 text-gray-900 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none">
          <option value="all">Tüm Konektörler</option>
          {connectorTypes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterPow} onChange={e => setFilterPow(e.target.value)}
          className="text-xs sm:text-sm bg-white border border-gray-300 text-gray-900 rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 sm:flex-none">
          <option value="all">Tüm Güç Seviyeleri</option>
          <option value="slow">AC Yavaş (≤22 kW)</option>
          <option value="fast">DC Hızlı (50 kW)</option>
          <option value="rapid">DC Süper Hızlı (150 kW)</option>
        </select>

        {user?.role === 'driver' && (
          <button
            onClick={() => setShowFavOnly(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors shrink-0 ${
              showFavOnly
                ? 'bg-pink-700 border-pink-600 text-white'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {showFavOnly ? 'Favorilerim (aktif)' : 'Favorilerim'}
          </button>
        )}


        <div className="hidden sm:flex ml-auto items-center gap-3 text-xs text-gray-500 flex-wrap">
          {[
            { key: 'available',   label: 'Müsait' },
            { key: 'occupied',    label: 'Dolu' },
            { key: 'offline',     label: 'Çevrimdışı' },
            { key: 'maintenance', label: 'Bakımda' },
            { key: 'inactive',    label: 'Pasif' },
          ].map(({ key, label }) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: STATUS_COLOR[key] }} />
              {label}
            </span>
          ))}
          <button
            onClick={() => getStations().then(setStations).catch(() => {})}
            className="ml-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg transition-colors"
            title="Listeyi yenile"
          ></button>
        </div>
      </div>

      {/*  Map + Right Panel  */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Map */}
        <div className="h-[55vh] md:h-auto md:flex-1 relative shrink-0 md:shrink">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse"></div>
                <p className="text-gray-500 text-sm">Google Maps yükleniyor…</p>
              </div>
            </div>
          )}

          {isLoaded && (
            <GoogleMap
              mapContainerStyle={MAP_STYLE}
              center={userLocation}
              zoom={12}
              options={MAP_OPTIONS}
              onLoad={onMapLoad}
            >
              {/* Kullanıcı konumu */}
              <MarkerF
                position={userLocation}
                icon={getUserMarkerIcon()}
                title="Konumunuz"
                zIndex={100}
              />

              {filtered.map((station) => {
                const status = getStationStatus(station);
                return (
                  <MarkerF
                    key={station.id}
                    position={{ lat: parseFloat(station.lat), lng: parseFloat(station.lng) }}
                    icon={getMarkerIcon(STATUS_COLOR[status] || '#6b7280')}
                    onClick={() => handleMarkerClick(station)}
                    title={station.name}
                  />
                );
              })}

              {infoStation && (() => {
                const dist = distanceKm(userLocation, {
                  lat: parseFloat(infoStation.lat),
                  lng: parseFloat(infoStation.lng),
                });
                const estMin = Math.round((dist / 40) * 60); // ~40 km/h ortalama
                const distLabel = dist < 1
                  ? `${Math.round(dist * 1000)} m`
                  : `${dist.toFixed(1)} km`;
                const timeLabel = estMin < 60
                  ? `~${estMin} dk`
                  : `~${Math.floor(estMin/60)}s ${estMin%60}dk`;
                return (
                  <InfoWindowF
                    position={{ lat: parseFloat(infoStation.lat), lng: parseFloat(infoStation.lng) }}
                    onCloseClick={() => setInfoStation(null)}
                  >
                    <div className="text-sm max-w-[200px]">
                      <p className="font-bold text-slate-900 mb-0.5">{infoStation.name}</p>
                      <p className="text-gray-400 text-xs mb-2">{infoStation.address}</p>
                      <div className="flex gap-3 text-xs text-gray-400 mb-2">
                        <span> {(infoStation.chargers || []).filter(c => c.status === 'available').length}/{(infoStation.chargers || []).length} müsait</span>
                      </div>
                      <div className="flex gap-2 text-xs bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 mb-3 text-blue-700">
                        <span> {distLabel}</span>
                        <span>·</span>
                        <span> {timeLabel}</span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleShowRoute(infoStation)}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors">
                           Yol Tarifi
                        </button>
                        <button
                          onClick={() => { setSelectedStation(infoStation); setInfoStation(null); }}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-1.5 px-2 rounded-lg transition-colors">
                          Seç
                        </button>
                      </div>
                    </div>
                  </InfoWindowF>
                );
              })()}

            </GoogleMap>
          )}
        </div>

        {/*  Right Panel  */}
        <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden md:shrink-0">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-900">{filtered.length} istasyon bulundu</p>
            <p className="text-xs text-gray-500">
              {locReady ? ' Konumunuza göre' : 'İzmir, Türkiye'}
            </p>
          </div>

          {/*  En çok kullanılan istasyon kartı  */}
          {topStation && (
            <div
              className="mx-3 mt-3 mb-1 bg-purple-900/30 border border-purple-700 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-purple-900/50 transition-colors"
              onClick={() => {
                const full = stations.find(s => s.id === topStation.id);
                if (full) { handleStationSelect(full); }
              }}
            >
              <p className="text-[10px] text-purple-400 font-semibold uppercase tracking-wide mb-1"> En Çok Kullandığınız İstasyon</p>
              <p className="text-sm font-semibold text-gray-900">{topStation.name}</p>
              <p className="text-xs text-gray-500">{topStation.address}</p>
              <p className="text-xs text-purple-300 mt-1">{topStation.session_count} tamamlanmış şarj</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {filtered.map((station) => {
              const status = getStationStatus(station);
              const avail  = (station.chargers || []).filter(c => c.status === 'available').length;
              const active = selectedStation?.id === station.id;
              return (
                <div key={station.id} onClick={() => handleStationSelect(station)}
                  className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                    active ? 'bg-blue-900/30 border-l-4 border-l-blue-500' : 'hover:bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{station.name}</p>
                      {topStation?.id === station.id && (
                        <span className="shrink-0 text-[10px] bg-purple-900/60 border border-purple-700 text-purple-300 px-1.5 py-0.5 rounded-full"></span>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{station.address}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <div className="flex gap-3">
                      <span> {avail}/{(station.chargers || []).length} müsait</span>
                      <span> {(() => { const d = distanceKm(userLocation, { lat: parseFloat(station.lat), lng: parseFloat(station.lng) }); return d < 1 ? `${Math.round(d*1000)}m` : `${d.toFixed(1)}km`; })()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {user?.role === 'driver' && (
                        <button
                          onClick={(e) => handleToggleFavorite(e, station.id)}
                          disabled={favLoading === station.id}
                          className={`transition-all ${favLoading === station.id ? 'opacity-40' : 'hover:scale-125'}`}
                          title={favoriteIds.has(station.id) ? 'Favoriden kaldir' : 'Favorilere ekle'}
                        >
                          {favoriteIds.has(station.id) ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-red-500">
                              <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-gray-400 hover:text-red-400">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                            </svg>
                          )}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShowRoute(station); }}
                        className="text-blue-400 hover:text-blue-300 text-[11px] underline"
                      >Yol Tarifi</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedStation && (
            <div className="border-t border-gray-200 bg-white p-4 shrink-0">
              <div className="flex items-start justify-between mb-0.5">
                <p className="font-semibold text-gray-900 text-sm">{selectedStation.name}</p>
                {user?.role === 'driver' && (
                  <button
                    onClick={(e) => handleToggleFavorite(e, selectedStation.id)}
                    disabled={favLoading === selectedStation.id}
                    className={`ml-2 transition-all shrink-0 ${favLoading === selectedStation.id ? 'opacity-40' : 'hover:scale-125'}`}
                    title={favoriteIds.has(selectedStation.id) ? 'Favoriden kaldir' : 'Favorilere ekle'}
                  >
                    {favoriteIds.has(selectedStation.id) ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-red-500">
                        <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gray-400 hover:text-red-400">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{selectedStation.address}</p>

              <div className="space-y-1.5 mb-4">
                {(selectedStation.chargers || []).map((c) => {
                  const compatible = !readOnly && selectedVehicle &&
                    (selectedVehicle.connector_type || selectedVehicle.connector) === c.connector_type;
                  return (
                    <div key={c.id}
                      className="flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[c.status] || '#6b7280' }} />
                      <span className="font-mono text-gray-700 flex-1">{c.charger_code}</span>
                      <span className="text-gray-500">{c.type} {c.power}kW</span>
                      <span className="text-gray-400">{c.connector_type}</span>
                      {!readOnly && selectedVehicle && (
                        <span className={compatible ? 'text-blue-400 font-bold' : 'text-red-400'}>
                          {compatible ? '' : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {!readOnly && (
                <button
                  onClick={() => {
                    if (!selectedVehicle) { alert(' Önce "Araçlarım" bölümünden bir araç seçin!'); return; }
                    setView('reservation');
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {selectedVehicle ? 'Rezervasyon Yap →' : ' Önce araç seçin'}
                </button>
              )}

              {/* Kuyruğa Katıl — uyumlu şarjcı var ama hepsi dolu ise */}
              {!readOnly && user?.role === 'driver' && selectedVehicle && (() => {
                const connType    = selectedVehicle.connector_type || selectedVehicle.connector;
                const compatible  = (selectedStation.chargers || []).filter(c => c.connector_type === connType);
                const hasAvail    = compatible.some(c => c.status === 'available');
                const hasOccupied = compatible.some(c => ['occupied', 'overstay'].includes(c.status));
                if (compatible.length === 0 || hasAvail || !hasOccupied) return null;

                const myEntry = myQueueEntries.find(e => String(e.station_id) === String(selectedStation.id));
                if (myEntry) {
                  return (
                    <div className="mt-2 bg-blue-900/30 border border-blue-700 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div>
                        {myEntry.status === 'notified' ? (
                          <>
                            <p className="text-blue-200 text-xs font-semibold"> Sıranız Geldi!</p>
                            <p className="text-blue-300 text-xs mt-0.5">30 dk içinde rezervasyon yapın!</p>
                          </>
                        ) : (
                          <p className="text-blue-300 text-xs font-semibold"> Kuyruktasınız — {myEntry.position}. sıra</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleLeaveQueue(selectedStation.id)}
                        disabled={queueLoading}
                        className="text-xs text-red-400 hover:text-red-300 shrink-0 transition-colors disabled:opacity-40"
                      >
                        Çık
                      </button>
                    </div>
                  );
                }
                return (
                  <button
                    onClick={() => handleJoinQueue(selectedStation.id, connType)}
                    disabled={queueLoading}
                    className="w-full mt-2 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700 text-blue-300 text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                     Kuyruğa Katıl
                  </button>
                );
              })()}

              {/* Sorun Bildir butonu — giriş yapmış herkes görebilir */}
              {user && (
                <button
                  onClick={() => setIssueStation(selectedStation)}
                  className="w-full mt-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 text-orange-400 text-sm font-medium py-2 rounded-xl transition-colors"
                >
                   Sorun Bildir
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
