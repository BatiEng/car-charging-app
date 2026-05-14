import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';

const TYPE_BADGE = {
  wallet_low:            { label: 'Cuzdan',     cls: 'bg-yellow-100 text-yellow-700' },
  station_malfunction:   { label: 'Ariza',      cls: 'bg-red-100 text-red-700'      },
  station_issue_reported:{ label: 'Sorun',      cls: 'bg-orange-100 text-orange-700' },
  reservation_confirmed: { label: 'Rezervasyon',cls: 'bg-blue-100 text-blue-700'    },
  reservation_cancelled: { label: 'Iptal',      cls: 'bg-gray-100 text-gray-600'    },
  session_started:       { label: 'Sarj',       cls: 'bg-green-100 text-green-700'  },
  session_completed:     { label: 'Tamamlandi', cls: 'bg-green-100 text-green-700'  },
};

const BellIcon = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const BellOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    <path d="M18.63 13A17.89 17.89 0 0 1 18 8"/>
    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
    <path d="M18 8a6 6 0 0 0-9.33-5"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

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
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] p-4"
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-900 text-sm">Bildirimler</span>
            {data.unread_count > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {data.unread_count}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {data.unread_count > 0 && (
              <button
                onClick={handleReadAll}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                Tumunu okundu isaretle
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded transition-colors"
            >
              <XIcon />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
          {data.notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex justify-center mb-3">
                <BellOffIcon />
              </div>
              <p className="text-gray-400 text-sm">Bildirim yok</p>
            </div>
          ) : (
            data.notifications.map(n => {
              const badge = TYPE_BADGE[n.type];
              return (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleRead(n.id)}
                  className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    n.is_read ? 'opacity-60' : 'bg-blue-50/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {badge && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                        <p className={`text-sm font-medium truncate ${n.is_read ? 'text-gray-500' : 'text-gray-900'}`}>
                          {n.title}
                        </p>
                      </div>
                      <p className="text-sm text-gray-500 leading-relaxed">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {new Date(n.created_at).toLocaleString('tr-TR')}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })
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
        className="relative p-2 rounded-lg hover:bg-gray-800 transition-colors"
        title="Bildirimler"
      >
        <BellIcon className="w-5 h-5 text-gray-400" />
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
