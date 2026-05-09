const NAV_ITEMS = [
  { id: 'vehicles',    label: 'My Vehicles',     icon: '🚗' },
  { id: 'map',         label: 'Find Station',     icon: '🗺️' },
  { id: 'reservation', label: 'Reservation',      icon: '📅' },
  { id: 'session',     label: 'Charging Session', icon: '⚡' },
]

export default function Sidebar({ view, setView, hasSession }) {
  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col shrink-0 h-full">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-slate-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-xl font-bold select-none">
          ⚡
        </div>
        <div>
          <p className="font-bold text-base leading-tight">EV Charge</p>
          <p className="text-slate-400 text-xs">Network Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm transition-all duration-150 ${
              view === item.id
                ? 'bg-green-600 text-white font-semibold shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === 'session' && hasSession && (
              <span className="ml-auto w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 text-center text-slate-500 text-xs">
        Group 18 · FSE Spring 2026
      </div>
    </aside>
  )
}
