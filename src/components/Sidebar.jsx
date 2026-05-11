import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

const DRIVER_NAV = [
  { id: 'vehicles',      label: 'Araçlar',   fullLabel: 'Araçlarım',         icon: '🚗' },
  { id: 'map',           label: 'Harita',    fullLabel: 'İstasyon Bul',       icon: '🗺️' },
  { id: 'reservation',   label: 'Rezerve',   fullLabel: 'Rezervasyon',        icon: '📅' },
  { id: 'myreservations',label: 'Listesi',   fullLabel: 'Rezervasyonlarım',   icon: '📋' },
  { id: 'session',       label: 'Şarj',      fullLabel: 'Şarj Oturumu',       icon: '⚡' },
  { id: 'wallet',        label: 'Cüzdan',    fullLabel: 'Cüzdan',             icon: '💳' },
];

const ADMIN_NAV = [
  { id: 'admin-users',        label: 'Kullanıcılar',  fullLabel: 'Kullanıcılar',       icon: '👤' },
  { id: 'admin-stations',     label: 'İstasyonlar',   fullLabel: 'İstasyonlar',        icon: '🏪' },
  { id: 'admin-reservations', label: 'Rezervasyonlar',fullLabel: 'Rezervasyonlar',     icon: '📅' },
  { id: 'admin-sessions',     label: 'Oturumlar',     fullLabel: 'Şarj Oturumları',    icon: '⚡' },
  { id: 'admin-revenue',      label: 'Gelir',         fullLabel: 'Gelir Raporu',       icon: '💰' },
  { id: 'admin-map',          label: 'Harita',        fullLabel: 'İstasyon Haritası',  icon: '🗺️' },
];

const OPERATOR_NAV = [
  { id: 'operator',           label: 'İstasyonum',   fullLabel: 'İstasyonlarım',       icon: '🏪' },
  { id: 'operator-map',       label: 'Harita',       fullLabel: 'İstasyon Haritası',   icon: '🗺️' },
];

const TECHNICIAN_NAV = [
  { id: 'technician',  label: 'Harita',    fullLabel: 'Teknisyen Görünümü', icon: '🔧' },
];

function getNav(role) {
  if (role === 'admin')      return ADMIN_NAV;
  if (role === 'operator')   return OPERATOR_NAV;
  if (role === 'technician') return TECHNICIAN_NAV;
  return DRIVER_NAV;
}

export default function Sidebar({ view, setView, hasSession }) {
  const { user, logout } = useAuth();
  const navItems = getNav(user?.role);

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 bg-slate-900 text-white flex-col shrink-0 h-full">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-slate-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-xl font-bold select-none">
            ⚡
          </div>
          <div>
            <p className="font-bold text-base leading-tight">EV Charge</p>
            <p className="text-slate-400 text-xs">Network Manager</p>
          </div>
        </div>

        {/* User info */}
        {user && (
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user.role}</p>
              {user.role === 'driver' && user.wallet_balance !== undefined && (
                <p className="text-xs text-emerald-400 mt-0.5">
                  💳 {parseFloat(user.wallet_balance).toFixed(2)} TL
                </p>
              )}
            </div>
            <NotificationBell />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm transition-all duration-150 ${
                view === item.id
                  ? 'bg-emerald-700 text-white font-semibold shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.fullLabel}</span>
              {item.id === 'session' && hasSession && (
                <span className="ml-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={logout}
            className="w-full text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            Çıkış Yap
          </button>
          <p className="text-center text-slate-600 text-xs mt-1">Group 18 · FSE 2026</p>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative ${
              view === item.id ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] leading-tight font-medium">{item.label}</span>
            {item.id === 'session' && hasSession && (
              <span className="absolute top-1.5 right-[calc(50%-12px)] w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            )}
            {view === item.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-400 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </>
  );
}
