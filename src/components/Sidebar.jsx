const NAV_ITEMS = [
  { id: 'vehicles',    label: 'Vehicles',  fullLabel: 'My Vehicles',     icon: '🚗' },
  { id: 'map',         label: 'Map',       fullLabel: 'Find Station',     icon: '🗺️' },
  { id: 'reservation', label: 'Reserve',   fullLabel: 'Reservation',      icon: '📅' },
  { id: 'session',     label: 'Charging',  fullLabel: 'Charging Session', icon: '⚡' },
]

export default function Sidebar({ view, setView, hasSession }) {
  return (
    <>
      {/* ── Desktop Sidebar (hidden on mobile) ── */}
      <aside className="hidden md:flex w-60 bg-slate-900 text-white flex-col shrink-0 h-full">
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
              <span>{item.fullLabel}</span>
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

      {/* ── Mobile Bottom Nav Bar (visible only on mobile) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex z-50 safe-bottom">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative ${
              view === item.id ? 'text-green-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] leading-tight font-medium">{item.label}</span>
            {item.id === 'session' && hasSession && (
              <span className="absolute top-1.5 right-[calc(50%-12px)] w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
            {view === item.id && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-400 rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </>
  )
}
