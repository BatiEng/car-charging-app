import { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

import { AuthProvider, useAuth } from './context/AuthContext';
import { getSessions }    from './services/api';
import Sidebar             from './components/Sidebar';
import Login               from './pages/Login';
import VehicleRegistration from './pages/VehicleRegistration';
import StationMap          from './pages/StationMap';
import Reservation         from './pages/Reservation';
import ChargingSession     from './pages/ChargingSession';
import WalletPage          from './pages/WalletPage';
import MyReservations      from './pages/MyReservations';
import AdminDashboard      from './pages/AdminDashboard';
import OperatorDashboard   from './pages/OperatorDashboard';
import TechnicianView      from './pages/TechnicianView';
import DemoTimeWidget      from './components/DemoTimeWidget';

const GOOGLE_MAPS_LIBRARIES = ['places'];

function AppInner() {
  const { user, loading } = useAuth();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  /*  Global state  */
  const [view, setView] = useState(() => {
    try { if (localStorage.getItem('ev_active_session')) return 'session'; } catch {}
    try {
      const saved = localStorage.getItem('ev_view');
      if (saved) return saved;
    } catch {}
    if (!user) return 'login';
    if (user.role === 'admin')      return 'admin-users';
    if (user.role === 'operator')   return 'operator';
    if (user.role === 'technician') return 'technician';
    return 'vehicles';
  });

  const [vehicles,        setVehicles]        = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedStation, setSelectedStation] = useState(null);
  const [reservation,     setReservation]     = useState(null);

  // Persist active session across refreshes
  // Yüklenirken kullanıcı ID'sini kontrol et — başka hesaba ait veri gösterilmesin
  const [activeSession, setActiveSessionRaw] = useState(() => {
    try {
      const s = localStorage.getItem('ev_active_session');
      if (!s) return null;
      const parsed = JSON.parse(s);
      // Oturum verisi mevcut kullanıcıya aitse yükle, değilse temizle
      if (user && parsed.user_id && String(parsed.user_id) !== String(user.id)) {
        localStorage.removeItem('ev_active_session');
        return null;
      }
      return parsed;
    } catch { return null; }
  });
  const setActiveSession = (s) => {
    setActiveSessionRaw(s);
    if (s) localStorage.setItem('ev_active_session', JSON.stringify(s));
    else   localStorage.removeItem('ev_active_session');
  };

  // Kullanıcı çıkış yapınca (user→null) tüm filtre/seçim state'leri temizle
  // Giriş yapınca role'e göre doğru view'a yönlendir
  useEffect(() => {
    if (!user) {
      setVehicles([]);
      setSelectedVehicle(null);
      setSelectedStation(null);
      setReservation(null);
      // Başka hesap açılınca önceki kullanıcının oturum verisi görünmesin
      setActiveSession(null);
      try { localStorage.removeItem('ev_view'); } catch {}
      try { localStorage.removeItem('ev_session_elapsed'); } catch {}
      try { localStorage.removeItem('ev_session_kwh'); } catch {}
      return;
    }
    const adminViews    = ['admin-users','admin-stations','admin-reservations','admin-sessions','admin-revenue','admin-vehicles','admin-issues','admin-map'];
    const operatorViews = ['operator','operator-map'];
    const techViews     = ['technician'];
    const driverViews   = ['vehicles','map','reservation','myreservations','session','wallet'];
    if (user.role === 'admin'      && !adminViews.includes(view))    setView('admin-users');
    if (user.role === 'operator'   && !operatorViews.includes(view)) setView('operator');
    if (user.role === 'technician' && !techViews.includes(view))     setView('technician');
    if (user.role === 'driver'     && !driverViews.includes(view))   setView('vehicles');

    // Sürücü giriş yaptığında aktif şarj seansı varsa geri yükle
    if (user.role === 'driver') {
      getSessions()
        .then(sessions => {
          const active = Array.isArray(sessions) ? sessions.find(s => s.status === 'active') : null;
          if (active) {
            setActiveSession({
              session_id:     active.id,
              started_at:     active.start_time,
              user_id:        user.id,
              reservation: {
                reservation_date: active.reservation_date,
                start_time:       active.res_start_time,
                end_time:         active.res_end_time,
                price_per_kwh:    active.price_per_kwh,
              },
              station_name:   active.station_name,
              station_address: active.station_address,
              charger_power:  active.power,
              charger_code:   active.charger_code,
              connector_type: active.connector_type,
              price_per_kwh:  active.price_per_kwh,
              plate:          active.plate,
              brand:          active.brand,
              model:          active.model,
            });
            setView('session');
          }
        })
        .catch(() => {});
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // view değişince localStorage'a kaydet
  useEffect(() => {
    try { localStorage.setItem('ev_view', view); } catch {}
  }, [view]);

  // If auth state changes (login/logout), redirect to the right default view
  const handleSetView = (v) => setView(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse"></div>
          <p className="text-gray-500">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar view={view} setView={handleSetView} hasSession={!!activeSession} />

      {/* pb-16 on mobile = space for fixed bottom nav */}
      <main className={`flex-1 overflow-auto pb-16 md:pb-0 ${
        view === 'map' || view === 'admin-map' || view === 'operator-map' || view === 'technician'
          ? 'flex flex-col' : ''
      }`}>

        {/*  Driver views  */}
        {view === 'vehicles' && (
          <VehicleRegistration
            vehicles={vehicles}               setVehicles={setVehicles}
            selectedVehicle={selectedVehicle} setSelectedVehicle={setSelectedVehicle}
            setView={handleSetView}
          />
        )}

        {view === 'map' && (
          <StationMap
            isLoaded={isLoaded}
            selectedStation={selectedStation} setSelectedStation={setSelectedStation}
            selectedVehicle={selectedVehicle}
            setView={handleSetView}
            user={user}
          />
        )}

        {view === 'reservation' && (
          <Reservation
            isLoaded={isLoaded}
            selectedStation={selectedStation}
            selectedVehicle={selectedVehicle}
            setView={handleSetView}
            setReservation={setReservation}
          />
        )}

        {view === 'session' && (
          <ChargingSession
            activeSession={activeSession}
            setActiveSession={setActiveSession}
            setView={handleSetView}
          />
        )}

        {view === 'wallet' && <WalletPage />}

        {view === 'myreservations' && <MyReservations setView={handleSetView} />}

        {/*  Admin views — her sekme ayrı sayfa  */}
        {['admin-users','admin-stations','admin-reservations','admin-sessions','admin-revenue','admin-vehicles','admin-issues'].includes(view) && (
          <AdminDashboard tab={view.replace('admin-','')} isLoaded={isLoaded} />
        )}
        {view === 'admin-map' && (
          <StationMap
            isLoaded={isLoaded}
            readOnly={true}
            selectedStation={selectedStation} setSelectedStation={setSelectedStation}
            selectedVehicle={null}
            setView={handleSetView}
            user={user}
          />
        )}

        {/*  Operator views  */}
        {view === 'operator' && <OperatorDashboard isLoaded={isLoaded} />}
        {view === 'operator-map' && (
          <StationMap
            isLoaded={isLoaded}
            readOnly={true}
            selectedStation={selectedStation} setSelectedStation={setSelectedStation}
            selectedVehicle={null}
            setView={handleSetView}
            user={user}
          />
        )}

        {/*  Technician views  */}
        {view === 'technician' && (
          <TechnicianView />
        )}
      </main>

      {/*  Demo time widget — admin & driver  */}
      {(user.role === 'admin' || user.role === 'driver') && <DemoTimeWidget />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
