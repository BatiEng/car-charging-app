import { useState, useEffect } from 'react';
import { getReservations, cancelReservation, getMyQueue, leaveQueue } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLE = {
  pending:   { bg: 'bg-yellow-900/40 border-yellow-700', text: 'text-yellow-300', label: 'Bekliyor' },
  active:    { bg: 'bg-blue-900/40 border-blue-700',     text: 'text-blue-300',   label: 'Aktif' },
  completed: { bg: 'bg-blue-900/40 border-blue-700', text: 'text-blue-300', label: 'Tamamlandı' },
  cancelled: { bg: 'bg-gray-100/40 border-gray-300',   text: 'text-gray-500', label: 'İptal Edildi' },
};

export default function MyReservations({ setView }) {
  const { refreshUser } = useAuth();
  const [reservations,  setReservations]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [cancelling,    setCancelling]    = useState(null);
  const [msg,           setMsg]           = useState('');
  const [error,         setError]         = useState('');
  const [queueEntries,  setQueueEntries]  = useState([]);
  const [queueLeaving,  setQueueLeaving]  = useState(null); // station_id being left

  const load = () => {
    setLoading(true);
    getReservations()
      .then(rows => setReservations(rows))
      .catch(() => {})
      .finally(() => setLoading(false));
    getMyQueue()
      .then(rows => setQueueEntries(rows))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (id) => {
    if (!confirm('Bu rezervasyonu iptal etmek istediğinizden emin misiniz? Ödeme iade edilecektir.')) return;
    setCancelling(id); setMsg(''); setError('');
    try {
      const res = await cancelReservation(id);
      setMsg(`Rezervasyon iptal edildi. ${res.refunded} TL cüzdanınıza iade edildi.`);
      load();
      refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  const handleLeaveQueue = async (stationId) => {
    if (!confirm('Kuyruktan çıkmak istediğinizden emin misiniz?')) return;
    setQueueLeaving(stationId);
    try {
      await leaveQueue(stationId);
      setQueueEntries(prev => prev.filter(e => String(e.station_id) !== String(stationId)));
    } catch (e) {
      setError(e.message);
    } finally {
      setQueueLeaving(null);
    }
  };

  // Rezervasyona 3 saatten az kaldı mı?
  const isWithin3Hours = (r) => {
    const resTime = new Date(`${r.reservation_date}T${r.start_time}`);
    const diffMs  = resTime - new Date();
    return diffMs < 3 * 60 * 60 * 1000; // 3 saat = 10800000 ms
  };

  const grouped = {
    active:    reservations.filter(r => r.status === 'active'),
    pending:   reservations.filter(r => r.status === 'pending'),
    completed: reservations.filter(r => r.status === 'completed'),
    cancelled: reservations.filter(r => r.status === 'cancelled'),
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Rezervasyonlarım</h2>
        <button onClick={load} className="text-sm text-blue-400 hover:text-blue-300">↻ Yenile</button>
      </div>

      {msg && (
        <div className="bg-blue-900/40 border border-blue-700 rounded-lg p-3 text-blue-300 text-sm"> {msg}</div>
      )}
      {error && (
        <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>
      )}

      {/*  Bekleme Kuyruğum  */}
      {queueEntries.length > 0 && (
        <div className="bg-white rounded-lg border border-blue-800 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-blue-300 mb-3"> Bekleme Kuyruğum ({queueEntries.length})</h3>
          <div className="space-y-2">
            {queueEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-3 bg-blue-900/20 border border-blue-800 rounded-xl px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{entry.station_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{entry.station_address}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-500"> {entry.connector_type}</span>
                    {entry.status === 'notified' ? (
                      <span className="text-xs font-semibold text-blue-200 animate-pulse"> Sıranız Geldi! 30 dk içinde rezervasyon yapın</span>
                    ) : (
                      <span className="text-xs text-blue-300">{entry.position}. sıra</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleLeaveQueue(entry.station_id)}
                  disabled={queueLeaving === entry.station_id}
                  className="shrink-0 text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  {queueLeaving === entry.station_id ? '…' : 'Çık'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-3xl mb-3 animate-pulse"></p>
          <p>Yükleniyor…</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-14 text-center">
          <p className="text-5xl mb-4"></p>
          <p className="text-gray-900 font-semibold mb-1">Rezervasyon bulunamadı</p>
          <p className="text-gray-500 text-sm mb-6">Henüz hiç rezervasyon yapmadınız.</p>
          <button onClick={() => setView('map')}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold">
            İstasyon Bul →
          </button>
        </div>
      ) : (
        ['active', 'pending', 'completed', 'cancelled'].map(status => {
          const list = grouped[status];
          if (list.length === 0) return null;
          const s = STATUS_STYLE[status];
          return (
            <div key={status}>
              <h3 className={`text-sm font-semibold mb-3 ${s.text}`}>
                {s.label} ({list.length})
              </h3>
              <div className="space-y-3">
                {list.map(r => (
                  <div key={r.id} className={`rounded-lg border p-4 sm:p-5 ${s.bg}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{r.station_name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.bg} ${s.text}`}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-gray-500 text-sm mt-0.5">{r.station_address}</p>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 mt-3 text-sm">
                          <span className="text-gray-500"> <span className="text-gray-800">{r.reservation_date}</span></span>
                          <span className="text-gray-500"> <span className="text-gray-800">{r.start_time?.slice(0,5)} – {r.end_time?.slice(0,5)}</span></span>
                          <span className="text-gray-500"> <span className="text-gray-800 font-mono">{r.charger_code}</span></span>
                          <span className="text-gray-500"> <span className="text-gray-800">{r.brand} {r.model}</span></span>
                          <span className="text-gray-500"> <span className="text-gray-800">{r.connector_type}</span></span>
                          <span className="text-gray-500"> <span className="text-blue-400 font-semibold">{parseFloat(r.amount_deducted).toFixed(2)} TL</span></span>
                        </div>
                      </div>

                      {/* Actions */}
                      {(status === 'pending') && (() => {
                        const tooLate = isWithin3Hours(r);
                        return (
                          <div className="shrink-0 flex flex-col items-end gap-1">
                            <button
                              onClick={() => handleCancel(r.id)}
                              disabled={cancelling === r.id || tooLate}
                              title={tooLate ? 'Başlangıca 3 saatten az kaldı, iptal edilemez' : ''}
                              className="bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {cancelling === r.id ? '…' : 'İptal Et'}
                            </button>
                            {tooLate && (
                              <span className="text-[10px] text-yellow-500 text-right max-w-[100px]">
                                 3 saatten az kaldı
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {status === 'active' && (
                        <button
                          onClick={() => setView('session')}
                          className="shrink-0 bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg"
                        >
                          Oturuma Git
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
