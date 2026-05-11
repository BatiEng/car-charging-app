import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleMap, MarkerF, InfoWindowF, DirectionsRenderer } from '@react-google-maps/api';
import { MAP_CENTER } from '../data/stations';
import { getMarkerIcon, getUserMarkerIcon, STATUS_COLOR, STATUS_BADGE } from '../utils/helpers';
import { getStations } from '../services/api';

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
  const [directions,   setDirections]   = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Kullanıcı konumu (varsayılan: İzmir merkezi)
  const [userLocation, setUserLocation] = useState(MAP_CENTER);
  const [locReady,     setLocReady]     = useState(false);

  // Yakın istasyon yoksa öneri banner'ı
  const [nearbyPrompt, setNearbyPrompt]         = useState(null); // { station, dist }
  const [promptDismissed, setPromptDismissed]   = useState(false);

  // ── Konum izni ───────────────────────────────────────────────
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

  // ── İstasyon verisi ──────────────────────────────────────────
  useEffect(() => {
    const load = () => getStations().then(setStations).catch(() => {});
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Yakın istasyon yoksa öner ────────────────────────────────
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

  // ── Araç değişince connector filtresi ────────────────────────
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
    return okConn && okPow;
  });

  const handleMarkerClick = (station) => {
    setInfoStation(station);
    setSelectedStation(station);
    setDirections(null);
    mapRef.current?.panTo({ lat: parseFloat(station.lat), lng: parseFloat(station.lng) });
  };

  const handleShowRoute = () => {
    if (!infoStation) return;
    setRouteLoading(true);
    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin:      userLocation,
        destination: { lat: parseFloat(infoStation.lat), lng: parseFloat(infoStation.lng) },
        travelMode:  window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        setRouteLoading(false);
        if (status === 'OK') { setDirections(result); setInfoStation(null); }
        else alert('Rota alınamadı: ' + status);
      }
    );
  };

  const handleStationSelect = (station) => {
    setSelectedStation(station);
    setInfoStation(station);
    setDirections(null);
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

  const STATUS_LABEL = { available: 'Müsait', occupied: 'Dolu', offline: 'Çevrimdışı', maintenance: '🔧 Bakımda', inactive: 'Pasif' };

  return (
    <div className="flex flex-col h-full">

      {/* ── Yakın istasyon yoksa banner ── */}
      {nearbyPrompt && !promptDismissed && (
        <div className="bg-amber-900/70 border-b border-amber-700 px-4 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
          <span className="text-sm text-amber-200 flex-1">
            📍 Konumunuza yakın ({nearbyPrompt.dist} km içinde) istasyon bulunamadı.
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

      {/* ── Filter Bar ── */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0">
        <span className="text-xs font-semibold text-slate-400 hidden sm:inline">Filtreler:</span>
        {selectedVehicle && !readOnly && (
          <span className="text-xs bg-emerald-900/50 border border-emerald-700 text-emerald-300 px-2 py-1 rounded-lg">
            🚗 {selectedVehicle.brand} {selectedVehicle.model} · {selectedVehicle.connector_type || selectedVehicle.connector}
          </span>
        )}
        {readOnly && (
          <span className="text-xs bg-slate-700 border border-slate-600 text-slate-400 px-2 py-1 rounded-lg">
            👁 Görüntüleme modu
          </span>
        )}

        <select value={filterConn} onChange={e => setFilterConn(e.target.value)}
          className="text-xs sm:text-sm bg-slate-800 border border-slate-600 text-white rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1 sm:flex-none">
          <option value="all">Tüm Konektörler</option>
          {connectorTypes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterPow} onChange={e => setFilterPow(e.target.value)}
          className="text-xs sm:text-sm bg-slate-800 border border-slate-600 text-white rounded-lg px-2 sm:px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 flex-1 sm:flex-none">
          <option value="all">Tüm Güç Seviyeleri</option>
          <option value="slow">AC Yavaş (≤22 kW)</option>
          <option value="fast">DC Hızlı (50 kW)</option>
          <option value="rapid">DC Süper Hızlı (150 kW)</option>
        </select>

        {directions && (
          <button onClick={() => setDirections(null)}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
            ✕ Rota
          </button>
        )}

        <div className="hidden sm:flex ml-auto items-center gap-3 text-xs text-slate-400 flex-wrap">
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
            className="ml-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded-lg transition-colors"
            title="Listeyi yenile"
          >🔄</button>
        </div>
      </div>

      {/* ── Map + Right Panel ── */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Map */}
        <div className="h-[55vh] md:h-auto md:flex-1 relative shrink-0 md:shrink">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 z-10">
              <div className="text-center">
                <div className="text-4xl mb-3 animate-pulse">🗺️</div>
                <p className="text-slate-400 text-sm">Google Maps yükleniyor…</p>
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

              {infoStation && (
                <InfoWindowF
                  position={{ lat: parseFloat(infoStation.lat), lng: parseFloat(infoStation.lng) }}
                  onCloseClick={() => setInfoStation(null)}
                >
                  <div className="text-sm max-w-xs">
                    <p className="font-bold text-slate-900 mb-0.5">{infoStation.name}</p>
                    <p className="text-slate-500 text-xs mb-2">{infoStation.address}</p>
                    <div className="flex gap-3 text-xs text-slate-600 mb-3">
                      <span>
                        ⚡ {(infoStation.chargers || []).filter(c => c.status === 'available').length}/
                        {(infoStation.chargers || []).length} müsait
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleShowRoute} disabled={routeLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors disabled:opacity-50">
                        {routeLoading ? '⏳' : '🗺️ Yol'}
                      </button>
                      <button
                        onClick={() => { setSelectedStation(infoStation); setInfoStation(null); }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors">
                        Seç
                      </button>
                    </div>
                  </div>
                </InfoWindowF>
              )}

              {directions && (
                <DirectionsRenderer directions={directions} options={{ suppressMarkers: false }} />
              )}
            </GoogleMap>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-700 flex flex-col overflow-hidden md:shrink-0">
          <div className="px-4 py-3 border-b border-slate-700">
            <p className="text-sm font-semibold text-white">{filtered.length} istasyon bulundu</p>
            <p className="text-xs text-slate-400">
              {locReady ? '📍 Konumunuza göre' : 'İzmir, Türkiye'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtered.map((station) => {
              const status = getStationStatus(station);
              const avail  = (station.chargers || []).filter(c => c.status === 'available').length;
              const active = selectedStation?.id === station.id;
              return (
                <div key={station.id} onClick={() => handleStationSelect(station)}
                  className={`p-4 border-b border-slate-800 cursor-pointer transition-colors ${
                    active ? 'bg-emerald-900/30 border-l-4 border-l-emerald-500' : 'hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <p className="font-medium text-sm text-white">{station.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status] || 'bg-slate-700 text-slate-300'}`}>
                      {STATUS_LABEL[status] ?? status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{station.address}</p>
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    <span>⚡ {avail}/{(station.chargers || []).length} müsait</span>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedStation && (
            <div className="border-t border-slate-700 bg-slate-800 p-4 shrink-0">
              <p className="font-semibold text-white text-sm mb-0.5">{selectedStation.name}</p>
              <p className="text-xs text-slate-400 mb-3">{selectedStation.address}</p>

              <div className="space-y-1.5 mb-4">
                {(selectedStation.chargers || []).map((c) => {
                  const compatible = !readOnly && selectedVehicle &&
                    (selectedVehicle.connector_type || selectedVehicle.connector) === c.connector_type;
                  return (
                    <div key={c.id}
                      className="flex items-center gap-2 text-xs bg-slate-700/50 border border-slate-700 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[c.status] || '#6b7280' }} />
                      <span className="font-mono text-slate-300 flex-1">{c.charger_code}</span>
                      <span className="text-slate-400">{c.type} {c.power}kW</span>
                      <span className="text-slate-500">{c.connector_type}</span>
                      {!readOnly && selectedVehicle && (
                        <span className={compatible ? 'text-emerald-400 font-bold' : 'text-red-400'}>
                          {compatible ? '✓' : '✗'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {!readOnly && (
                <button
                  onClick={() => {
                    if (!selectedVehicle) { alert('⚠️ Önce "Araçlarım" bölümünden bir araç seçin!'); return; }
                    setView('reservation');
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                >
                  {selectedVehicle ? 'Rezervasyon Yap →' : '⚠️ Önce araç seçin'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
