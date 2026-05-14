import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

/* ── SVG Icon Components ── */
const IconCar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
    <rect x="7" y="14" width="10" height="6" rx="1"/>
    <path d="M5 9l2-4h10l2 4"/>
  </svg>
);

const IconMap = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/>
    <line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
);

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

const IconList = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/>
    <line x1="8" y1="12" x2="21" y2="12"/>
    <line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/>
    <line x1="3" y1="12" x2="3.01" y2="12"/>
    <line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);

const IconBolt = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconWallet = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
    <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
  </svg>
);

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconBuilding = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/>
    <path d="M9 22v-4h6v4"/>
    <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/>
  </svg>
);

const IconBarChart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
);

const IconAlert = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconTool = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

const IconLogout = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

/* ── Nav definitions ── */
const DRIVER_NAV = [
  { id: 'vehicles',       label: 'Araçlar',    fullLabel: 'Araçlarım',          Icon: IconCar      },
  { id: 'map',            label: 'Harita',     fullLabel: 'İstasyon Bul',        Icon: IconMap      },
  { id: 'reservation',    label: 'Rezerve',    fullLabel: 'Rezervasyon',         Icon: IconCalendar },
  { id: 'myreservations', label: 'Listesi',    fullLabel: 'Rezervasyonlarım',    Icon: IconList     },
  { id: 'session',        label: 'Sarj',       fullLabel: 'Sarj Oturumu',        Icon: IconBolt     },
  { id: 'wallet',         label: 'Cuzdan',     fullLabel: 'Cuzdan',              Icon: IconWallet   },
];

const ADMIN_NAV = [
  { id: 'admin-users',        label: 'Kullanicilar',   fullLabel: 'Kullanicilar',        Icon: IconUsers    },
  { id: 'admin-stations',     label: 'Istasyonlar',    fullLabel: 'Istasyonlar',         Icon: IconBuilding },
  { id: 'admin-reservations', label: 'Rezervasyonlar', fullLabel: 'Rezervasyonlar',      Icon: IconCalendar },
  { id: 'admin-sessions',     label: 'Oturumlar',      fullLabel: 'Sarj Oturumlari',     Icon: IconBolt     },
  { id: 'admin-revenue',      label: 'Gelir',          fullLabel: 'Gelir Raporu',        Icon: IconBarChart },
  { id: 'admin-vehicles',     label: 'Araclar',        fullLabel: 'Kullanici Araclari',  Icon: IconCar      },
  { id: 'admin-issues',       label: 'Arizalar',       fullLabel: 'Arizalar & Sorunlar', Icon: IconAlert    },
  { id: 'admin-map',          label: 'Harita',         fullLabel: 'Istasyon Haritasi',   Icon: IconMap      },
];

const OPERATOR_NAV = [
  { id: 'operator',     label: 'Istasyonum', fullLabel: 'Istasyonlarim',     Icon: IconBuilding },
  { id: 'operator-map', label: 'Harita',     fullLabel: 'Istasyon Haritasi', Icon: IconMap      },
];

const TECHNICIAN_NAV = [
  { id: 'technician', label: 'Harita', fullLabel: 'Teknisyen Gorunumu', Icon: IconTool },
];

function getNav(role) {
  if (role === 'admin')      return ADMIN_NAV;
  if (role === 'operator')   return OPERATOR_NAV;
  if (role === 'technician') return TECHNICIAN_NAV;
  return DRIVER_NAV;
}

const ROLE_LABELS = {
  admin:      'Yonetici',
  operator:   'Operator',
  technician: 'Teknisyen',
  driver:     'Surucu',
};

export default function Sidebar({ view, setView, hasSession }) {
  const { user, logout } = useAuth();
  const navItems = getNav(user?.role);

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 bg-gray-900 text-white flex-col shrink-0 h-full border-r border-gray-800">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-white leading-tight">EV Charge</p>
              <p className="text-gray-500 text-xs">Network Manager</p>
            </div>
          </div>
        </div>

        {/* User info */}
        {user && (
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-100 truncate">{user.name}</p>
              <p className="text-xs text-gray-500">{ROLE_LABELS[user.role] || user.role}</p>
              {user.role === 'driver' && user.wallet_balance !== undefined && (
                <p className="text-xs text-blue-400 mt-0.5 font-mono">
                  {parseFloat(user.wallet_balance).toFixed(2)} TL
                </p>
              )}
            </div>
            <NotificationBell />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ id, fullLabel, Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${
                view === id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              <Icon />
              <span className="font-medium">{fullLabel}</span>
              {id === 'session' && hasSession && (
                <span className="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 transition-colors py-1"
          >
            <IconLogout />
            <span>Cikis Yap</span>
          </button>
          <p className="text-gray-700 text-xs mt-2">Group 18 · FSE 2026</p>
        </div>
      </aside>

      {/* ── Mobile Bottom Nav Bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative ${
              view === id ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon />
            <span className="text-[10px] leading-tight font-medium">{label}</span>
            {id === 'session' && hasSession && (
              <span className="absolute top-1.5 right-[calc(50%-12px)] w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
            {view === id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </>
  );
}
