import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';

const TYPE_ICON = {
  wallet_low:            '💳',
  station_malfunction:   '🔧',
  reservation_confirmed: '✅',
  reservation_cancelled: '❌',
  session_started:       '⚡',
  session_completed:     '🏁',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ notifications: [], unread_count: 0 });

  const load = () => getNotifications().then(setData).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const handleRead = async (id) => {
    await markNotificationRead(id).catch(() => {});
    load();
  };

  const handleReadAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    load();
  };

  const modal = open && createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <span className="font-semibold text-white">Bildirimler</span>
            {data.unread_count > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {data.unread_count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data.unread_count > 0 && (
              <button onClick={handleReadAll} className="text-xs text-emerald-400 hover:text-emerald-300">
                Tümünü okundu işaretle
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-700">
          {data.notifications.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🔕</p>
              <p className="text-slate-400 text-sm">Bildirim yok</p>
            </div>
          ) : (
            data.notifications.map(n => (
              <div
                key={n.id}
                onClick={() => !n.is_read && handleRead(n.id)}
                className={`px-5 py-4 cursor-pointer hover:bg-slate-700/50 transition-colors ${
                  n.is_read ? 'opacity-60' : 'bg-slate-700/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${n.is_read ? 'text-slate-300' : 'text-white'}`}>
                      {n.title}
                    </p>
                    <p className="text-sm text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                    <p className="text-xs text-slate-500 mt-1.5">
                      {new Date(n.created_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-full hover:bg-slate-700 transition-colors"
        title="Bildirimler"
      >
        <span className="text-xl">🔔</span>
        {data.unread_count > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
            {data.unread_count > 9 ? '9+' : data.unread_count}
          </span>
        )}
      </button>
      {modal}
    </>
  );
}
