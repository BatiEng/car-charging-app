import { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

import { AuthProvider, useAuth } from './context/AuthContext';
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

  /* ── Global state ── */
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

  // Kullanıcı çıkış yapınca (user→null) tüm filtre/seçim state'leri temizle
  // Giriş yapınca role'e göre doğru view'a yönlendir
  useEffect(() => {
    if (!user) {
      setVehicles([]);
      setSelectedVehicle(null);
      setSelectedStation(null);
      setReservation(null);
      try { localStorage.removeItem('ev_view'); } catch {}
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
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist active session across refreshes
  const [activeSession, setActiveSessionRaw] = useState(() => {
    try { const s = localStorage.getItem('ev_active_session'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const setActiveSession = (s) => {
    setActiveSessionRaw(s);
    if (s) localStorage.setItem('ev_active_session', JSON.stringify(s));
    else   localStorage.removeItem('ev_active_session');
  };

  // view değişince localStorage'a kaydet
  useEffect(() => {
    try { localStorage.setItem('ev_view', view); } catch {}
  }, [view]);

  // If auth state changes (login/logout), redirect to the right default view
  const handleSetView = (v) => setView(v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">⚡</div>
          <p className="text-slate-400">Yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar view={view} setView={handleSetView} hasSession={!!activeSession} />

      {/* pb-16 on mobile = space for fixed bottom nav */}
      <main className={`flex-1 overflow-auto pb-16 md:pb-0 ${
        view === 'map' || view === 'admin-map' || view === 'operator-map' || view === 'technician'
          ? 'flex flex-col' : ''
      }`}>

        {/* ── Driver views ── */}
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

        {/* ── Admin views — her sekme ayrı sayfa ── */}
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

        {/* ── Operator views ── */}
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

        {/* ── Technician views ── */}
        {view === 'technician' && (
          <TechnicianView />
        )}
      </main>

      {/* ── Demo time widget — admin only ── */}
      {user.role === 'admin' && <DemoTimeWidget />}
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
