import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { getStations, patchCharger } from '../services/api';

const MAP_LIBRARIES = ['places'];
const MAP_CENTER    = { lat: 38.4237, lng: 27.1428 };
const MAP_STYLES    = [
  { elementType: 'geometry',       stylers: [{ color: '#1a2332' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'road',           elementType: 'geometry', stylers: [{ color: '#2c3e50' }] },
  { featureType: 'water',          elementType: 'geometry', stylers: [{ color: '#0e2137' }] },
];

const STATUS_COLOR = { available: '#10b981', occupied: '#3b82f6', offline: '#ef4444' };

function markerIcon(status) {
  const color = STATUS_COLOR[status] || '#6b7280';
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="16" fill="${color}" stroke="white" stroke-width="3"/>
        <text x="18" y="23" text-anchor="middle" font-size="14" fill="white">🔧</text>
      </svg>`
    )}`,
    scaledSize: new window.google.maps.Size(36, 36),
    anchor:     new window.google.maps.Point(18, 18),
  };
}

export default function TechnicianView() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg]           = useState('');
  const [mapRef, setMapRef]     = useState(null);

  const load = () => getStations().then(setStations).catch(() => {});
  useEffect(() => { load(); }, []);

  const onMapLoad = useCallback(map => setMapRef(map), []);

  const handleFixCharger = async (chargerId, currentStatus) => {
    if (currentStatus === 'available') {
      setMsg('Bu şarjcı zaten müsait durumda.');
      return;
    }
    try {
      await patchCharger(chargerId, 'available');
      setMsg('Şarjcı müsait olarak işaretlendi ✓');
      setSelected(null);
      load();
    } catch (e) { setMsg(e.message); }
  };

  // All chargers flattened for the map
  const allChargers = stations.flatMap(s =>
    (s.chargers || []).map(c => ({ ...c, station_name: s.name, station_lat: s.lat, station_lng: s.lng }))
  );

  const offlineCount  = allChargers.filter(c => c.status === 'offline').length;
  const occupiedCount = allChargers.filter(c => c.status === 'occupied').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="p-4 sm:p-6 border-b border-slate-700 flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-bold text-white">Teknisyen Görünümü</h2>
        <div className="flex gap-3 ml-auto">
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400" /> {offlineCount} çevrimdışı
          </span>
          <span className="flex items-center gap-1.5 text-sm text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> {occupiedCount} dolu
          </span>
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> {allChargers.length - offlineCount - occupiedCount} müsait
          </span>
        </div>
      </div>

      {msg && (
        <div className="mx-4 mt-3 bg-emerald-900/40 border border-emerald-700 rounded-lg p-3 text-emerald-300 text-sm">
          {msg}
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%', minHeight: '400px' }}
            center={MAP_CENTER}
            zoom={12}
            onLoad={onMapLoad}
            options={{ styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true }}
          >
            {allChargers.map(ch => (
              <MarkerF
                key={ch.id}
                position={{ lat: parseFloat(ch.station_lat), lng: parseFloat(ch.station_lng) }}
                icon={markerIcon(ch.status)}
                title={`${ch.charger_code} – ${ch.status}`}
                onClick={() => setSelected(ch)}
              />
            ))}

            {selected && (
              <InfoWindowF
                position={{ lat: parseFloat(selected.station_lat), lng: parseFloat(selected.station_lng) }}
                onCloseClick={() => setSelected(null)}
              >
                <div className="bg-slate-900 text-white rounded-lg p-3 min-w-[180px]">
                  <p className="font-semibold">{selected.station_name}</p>
                  <p className="text-sm font-mono mt-1">{selected.charger_code}</p>
                  <p className="text-sm mt-0.5 capitalize">
                    Durum: <span className={
                      selected.status === 'available' ? 'text-emerald-400' :
                      selected.status === 'offline'   ? 'text-red-400' : 'text-blue-400'
                    }>{selected.status}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{selected.type} · {selected.power} kW · {selected.connector_type}</p>
                  {selected.status !== 'available' && (
                    <button
                      onClick={() => handleFixCharger(selected.id, selected.status)}
                      className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-1.5 rounded-lg"
                    >
                      Onarıldı – Müsait İşaretle
                    </button>
                  )}
                </div>
              </InfoWindowF>
            )}
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-400">
            Harita yükleniyor...
          </div>
        )}
      </div>

      {/* Offline charger list */}
      {offlineCount > 0 && (
        <div className="p-4 border-t border-slate-700">
          <h4 className="text-sm font-semibold text-red-400 mb-2">Çevrimdışı Şarjcılar</h4>
          <div className="flex flex-wrap gap-2">
            {allChargers.filter(c => c.status === 'offline').map(c => (
              <button
                key={c.id}
                onClick={() => { setSelected(c); mapRef?.panTo({ lat: parseFloat(c.station_lat), lng: parseFloat(c.station_lng) }); }}
                className="bg-red-900/40 border border-red-700 text-red-300 text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/60"
              >
                {c.charger_code} · {c.station_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
