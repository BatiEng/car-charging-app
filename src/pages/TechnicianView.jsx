import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { getStations, patchCharger, updateStation, getMyIssues, patchIssue, cannotFixIssue } from '../services/api';

const MAP_LIBRARIES = ['places'];
const MAP_CENTER    = { lat: 38.4237, lng: 27.1428 };
const MAP_STYLES    = [
  { elementType: 'geometry',       stylers: [{ color: '#1a2332' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'road',           elementType: 'geometry', stylers: [{ color: '#2c3e50' }] },
  { featureType: 'water',          elementType: 'geometry', stylers: [{ color: '#0e2137' }] },
];

const STATUS_COLOR = {
  available:   '#10b981',
  occupied:    '#3b82f6',
  offline:     '#ef4444',
  overstay:    '#f97316',
  maintenance: '#f59e0b',
};

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

function maintenanceMarkerIcon() {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="20" fill="#f59e0b" stroke="white" stroke-width="3"/>
        <text x="22" y="28" text-anchor="middle" font-size="18" fill="white">🏗</text>
      </svg>`
    )}`,
    scaledSize: new window.google.maps.Size(44, 44),
    anchor:     new window.google.maps.Point(22, 22),
  };
}

export default function TechnicianView() {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

  const [stations,        setStations]       = useState([]);
  const [issues,          setIssues]         = useState([]);
  const [selected,        setSelected]       = useState(null);  // selected charger
  const [selectedStation, setSelectedStation] = useState(null); // selected maintenance station
  const [msg,             setMsg]            = useState('');
  const [msgType,         setMsgType]        = useState('success'); // 'success' | 'error'
  const [actionLoading,   setActionLoading]  = useState(false);
  const [mapRef,          setMapRef]         = useState(null);

  const load = () => {
    getStations().then(setStations).catch(() => {});
    getMyIssues().then(setIssues).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const onMapLoad = useCallback(map => setMapRef(map), []);

  const showMsg = (text, type = 'success') => { setMsg(text); setMsgType(type); };

  const handleFixCharger = async (chargerId, currentStatus) => {
    if (currentStatus === 'available') {
      showMsg('Bu şarjcı zaten müsait durumda.', 'error');
      return;
    }
    try {
      await patchCharger(chargerId, 'available');
      showMsg('Şarjcı müsait olarak işaretlendi ✓');
      setSelected(null);
      load();
    } catch (e) { showMsg(e.message, 'error'); }
  };

  // Onarıldı: ilgili in_progress ticketi resolved yap → issues.php otomatik istasyonu active'e çeker
  const handleFixStation = async (stationId) => {
    setActionLoading(true);
    try {
      const issue = issues.find(
        i => String(i.station_id) === String(stationId) && i.status === 'in_progress'
      );
      if (issue) {
        await patchIssue(issue.id, 'resolved');
      } else {
        // Arıza kaydı yoksa direkt istasyonu aktife al
        await updateStation(stationId, { status: 'active' });
      }
      showMsg('Onarım tamamlandı – istasyon aktif, ticket çözüldü ✓');
      setSelectedStation(null);
      load();
    } catch (e) { showMsg(e.message, 'error'); }
    finally { setActionLoading(false); }
  };

  // Onarılamaz: istasyonu pasife al, ticket in_progress kalır (admin/operatör yeniden atayabilir)
  const handleCannotFixStation = async (stationId) => {
    setActionLoading(true);
    try {
      const issue = issues.find(
        i => String(i.station_id) === String(stationId) && i.status === 'in_progress'
      );
      if (issue) {
        await cannotFixIssue(issue.id); // ticket open'a döner, istasyon inactive olur
      } else {
        await updateStation(stationId, { status: 'inactive' });
      }
      showMsg('İstasyon çevrimdışı yapıldı. Arıza kaydı yeniden açıldı, operatör yeniden atama yapabilir.', 'error');
      setSelectedStation(null);
      load();
    } catch (e) { showMsg(e.message, 'error'); }
    finally { setActionLoading(false); }
  };

  // All chargers flattened for the map
  const allChargers = stations.flatMap(s =>
    (s.chargers || []).map(c => ({ ...c, station_name: s.name, station_lat: s.lat, station_lng: s.lng, station_status: s.status }))
  );

  const maintenanceStations = stations.filter(s => s.status === 'maintenance');
  const offlineCount        = allChargers.filter(c => c.status === 'offline').length;
  const occupiedCount       = allChargers.filter(c => c.status === 'occupied').length;
  const overstayCount       = allChargers.filter(c => c.status === 'overstay').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="p-4 sm:p-6 border-b border-slate-700 flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-bold text-white">Teknisyen Görünümü</h2>
        <div className="flex flex-wrap gap-3 ml-auto">
          {maintenanceStations.length > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-400" /> {maintenanceStations.length} bakımda
            </span>
          )}
          {overstayCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-orange-400">
              <span className="w-2 h-2 rounded-full bg-orange-400" /> {overstayCount} overstay
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-red-400">
            <span className="w-2 h-2 rounded-full bg-red-400" /> {offlineCount} çevrimdışı
          </span>
          <span className="flex items-center gap-1.5 text-sm text-blue-400">
            <span className="w-2 h-2 rounded-full bg-blue-400" /> {occupiedCount} dolu
          </span>
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> {allChargers.filter(c => c.status === 'available').length} müsait
          </span>
        </div>
      </div>

      {msg && (
        <div className={`mx-4 mt-3 rounded-lg p-3 text-sm flex items-start justify-between gap-2 ${
          msgType === 'error'
            ? 'bg-red-900/40 border border-red-700 text-red-300'
            : 'bg-emerald-900/40 border border-emerald-700 text-emerald-300'
        }`}>
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="shrink-0 opacity-60 hover:opacity-100 text-xs">✕</button>
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
            {/* Charger markers */}
            {allChargers.map(ch => (
              <MarkerF
                key={`ch-${ch.id}`}
                position={{ lat: parseFloat(ch.station_lat), lng: parseFloat(ch.station_lng) }}
                icon={markerIcon(ch.status)}
                title={`${ch.charger_code} – ${ch.status}`}
                onClick={() => { setSelected(ch); setSelectedStation(null); }}
              />
            ))}

            {/* Maintenance station markers (larger, yellow) */}
            {maintenanceStations.map(s => (
              <MarkerF
                key={`st-${s.id}`}
                position={{ lat: parseFloat(s.lat), lng: parseFloat(s.lng) }}
                icon={maintenanceMarkerIcon()}
                title={`${s.name} – BAKIM`}
                onClick={() => { setSelectedStation(s); setSelected(null); }}
                zIndex={10}
              />
            ))}

            {/* Charger info window */}
            {selected && (
              <InfoWindowF
                position={{ lat: parseFloat(selected.station_lat), lng: parseFloat(selected.station_lng) }}
                onCloseClick={() => setSelected(null)}
              >
                <div style={{ background: '#1e293b', color: 'white', borderRadius: 8, padding: 12, minWidth: 180 }}>
                  <p style={{ fontWeight: 600 }}>{selected.station_name}</p>
                  <p style={{ fontSize: 12, fontFamily: 'monospace', marginTop: 4 }}>{selected.charger_code}</p>
                  <p style={{ fontSize: 12, marginTop: 2 }}>
                    Durum: <span style={{ color: STATUS_COLOR[selected.status] || '#9ca3af' }}>{selected.status}</span>
                  </p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{selected.type} · {selected.power} kW · {selected.connector_type}</p>
                  {selected.status !== 'available' && (
                    <button
                      onClick={() => handleFixCharger(selected.id, selected.status)}
                      style={{ marginTop: 8, width: '100%', background: '#059669', color: 'white', border: 'none', borderRadius: 6, padding: '6px 0', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}
                    >
                      Onarıldı – Müsait İşaretle
                    </button>
                  )}
                </div>
              </InfoWindowF>
            )}

            {/* Maintenance station info window */}
            {selectedStation && (
              <InfoWindowF
                position={{ lat: parseFloat(selectedStation.lat), lng: parseFloat(selectedStation.lng) }}
                onCloseClick={() => setSelectedStation(null)}
              >
                <div style={{ background: '#1e293b', color: 'white', borderRadius: 8, padding: 12, minWidth: 210 }}>
                  <p style={{ fontWeight: 600 }}>{selectedStation.name}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{selectedStation.address}</p>
                  <p style={{ fontSize: 12, marginTop: 6, color: '#fbbf24', fontWeight: 600 }}>🏗 Bakımda</p>
                  <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {(selectedStation.chargers || []).length} şarjcı
                  </p>
                  {/* Atanmış açık ticket bilgisi */}
                  {(() => {
                    const issue = issues.find(
                      i => String(i.station_id) === String(selectedStation.id) && i.status === 'in_progress'
                    );
                    return issue ? (
                      <p style={{ fontSize: 10, color: '#fb923c', marginTop: 4, background: '#431407', borderRadius: 4, padding: '3px 6px' }}>
                        🔧 {issue.title}
                      </p>
                    ) : null;
                  })()}
                  {/* Onarıldı butonu */}
                  <button
                    disabled={actionLoading}
                    onClick={() => handleFixStation(selectedStation.id)}
                    style={{ marginTop: 8, width: '100%', background: actionLoading ? '#374151' : '#059669', color: 'white', border: 'none', borderRadius: 6, padding: '6px 0', fontWeight: 600, fontSize: 11, cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {actionLoading ? '…' : '✅ Onarıldı – Aktif Yap'}
                  </button>
                  {/* Onarılamaz butonu */}
                  <button
                    disabled={actionLoading}
                    onClick={() => handleCannotFixStation(selectedStation.id)}
                    style={{ marginTop: 6, width: '100%', background: actionLoading ? '#374151' : '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b', borderRadius: 6, padding: '6px 0', fontWeight: 600, fontSize: 11, cursor: actionLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {actionLoading ? '…' : '⛔ Onarılamaz – Çevrimdışı Yap'}
                  </button>
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

      {/* Bottom lists */}
      {(maintenanceStations.length > 0 || offlineCount > 0 || overstayCount > 0) && (
        <div className="border-t border-slate-700 divide-y divide-slate-700/60">

          {/* Maintenance stations */}
          {maintenanceStations.length > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">🏗 Bakımdaki İstasyonlar</h4>
              <div className="flex flex-wrap gap-2">
                {maintenanceStations.map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedStation(s);
                      setSelected(null);
                      mapRef?.panTo({ lat: parseFloat(s.lat), lng: parseFloat(s.lng) });
                      mapRef?.setZoom(15);
                    }}
                    className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-xs px-3 py-1.5 rounded-lg hover:bg-yellow-900/50 transition-colors"
                  >
                    🏗 {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Overstay chargers */}
          {overstayCount > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-orange-400 mb-2">⚠️ Overstay Şarjcılar</h4>
              <div className="flex flex-wrap gap-2">
                {allChargers.filter(c => c.status === 'overstay').map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setSelectedStation(null); mapRef?.panTo({ lat: parseFloat(c.station_lat), lng: parseFloat(c.station_lng) }); }}
                    className="bg-orange-900/30 border border-orange-700 text-orange-300 text-xs px-3 py-1.5 rounded-lg hover:bg-orange-900/50 transition-colors"
                  >
                    {c.charger_code} · {c.station_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Offline chargers */}
          {offlineCount > 0 && (
            <div className="p-4">
              <h4 className="text-sm font-semibold text-red-400 mb-2">Çevrimdışı Şarjcılar</h4>
              <div className="flex flex-wrap gap-2">
                {allChargers.filter(c => c.status === 'offline').map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setSelected(c); setSelectedStation(null); mapRef?.panTo({ lat: parseFloat(c.station_lat), lng: parseFloat(c.station_lng) }); }}
                    className="bg-red-900/40 border border-red-700 text-red-300 text-xs px-3 py-1.5 rounded-lg hover:bg-red-900/60 transition-colors"
                  >
                    {c.charger_code} · {c.station_name}
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
