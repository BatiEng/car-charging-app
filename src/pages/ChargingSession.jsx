import { useState, useEffect, useRef, useCallback } from 'react';
import { fmtTime } from '../utils/helpers';
import {
  getReservations, startSession, endSession,
  checkExtension, extendSession, markSessionOverstay,
  getDemoTime,
} from '../services/api';

const GRACE_SECONDS   = 120;  // 2 dakika grace period
const PENALTY_PER_MIN = 2.0;  // TL per overstay minute

export default function ChargingSession({ activeSession, setActiveSession, setView }) {
  // ── PIN entry / session start ──────────────────────────────
  const [reservations, setReservations]   = useState([]);
  const [selectedRes,  setSelectedRes]    = useState(null);
  const [pin,          setPin]            = useState('');
  const [pinError,     setPinError]       = useState('');
  const [starting,     setStarting]       = useState(false);

  // ── Live session state ─────────────────────────────────────
  const [elapsed,  setElapsed]  = useState(() => {
    try { return parseInt(localStorage.getItem('ev_session_elapsed') || '0'); } catch { return 0; }
  });
  const [kwh,      setKwh]      = useState(() => {
    try { return parseFloat(localStorage.getItem('ev_session_kwh') || '0'); } catch { return 0; }
  });
  const [done,     setDone]     = useState(false);
  const [receipt,  setReceipt]  = useState(null);
  const [stopping, setStopping] = useState(false);

  // ── Demo time polling ──────────────────────────────────────
  const [demoTimeMs,    setDemoTimeMs]    = useState(null);
  // After extension, override local reservation end time
  const [resEndOverride, setResEndOverride] = useState(null);

  // ── Extension state ────────────────────────────────────────
  const [extCheck,  setExtCheck]  = useState(null);
  const [extending, setExtending] = useState(false);
  const [extResult, setExtResult] = useState(null);

  const timerRef          = useRef(null);
  const demoTimerRef      = useRef(null);
  const overstayMarkedRef = useRef(false);

  // ── Compute reservation end time in ms ───────────────────
  const reservationEndMs = (() => {
    if (resEndOverride) return resEndOverride;
    if (!activeSession?.reservation) return null;
    const res = activeSession.reservation;
    const dt  = new Date(`${res.reservation_date}T${res.end_time}`);
    return isNaN(dt.getTime()) ? null : dt.getTime();
  })();
  const graceEndMs = reservationEndMs ? reservationEndMs + GRACE_SECONDS * 1000 : null;

  // ── Phase calculation (based on demo time) ────────────────
  let phase            = 'charging';  // 'charging' | 'grace' | 'overstay'
  let overstayMs       = 0;
  let graceRemainingMs = GRACE_SECONDS * 1000;
  let timeRemainingMs  = 0;

  if (demoTimeMs !== null && reservationEndMs !== null) {
    if (demoTimeMs >= graceEndMs) {
      phase      = 'overstay';
      overstayMs = demoTimeMs - graceEndMs;
    } else if (demoTimeMs >= reservationEndMs) {
      phase            = 'grace';
      graceRemainingMs = graceEndMs - demoTimeMs;
    } else {
      timeRemainingMs = reservationEndMs - demoTimeMs;
    }
  }

  const overstayTotalSeconds = overstayMs / 1000;
  const overstayMinutes      = overstayTotalSeconds / 60;
  const overstayPenalty      = parseFloat((overstayMinutes * PENALTY_PER_MIN).toFixed(2));
  const graceRemainingS      = Math.max(0, Math.ceil(graceRemainingMs / 1000));

  // ── Format remaining time ─────────────────────────────────
  function fmtRemaining(ms) {
    if (ms <= 0) return '0:00';
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}sa ${m.toString().padStart(2, '0')}dk`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Load pending reservations when no active session ──────
  useEffect(() => {
    if (!activeSession) {
      getReservations()
        .then(rows => setReservations(rows.filter(r => r.status === 'pending' || r.status === 'active')))
        .catch(() => {});
    }
  }, [activeSession]);

  // ── Poll demo time every 5 seconds ───────────────────────
  const pollDemoTime = useCallback(async () => {
    try {
      const d  = await getDemoTime();
      const dt = new Date(d.demo_time.replace(' ', 'T'));
      if (!isNaN(dt.getTime())) setDemoTimeMs(dt.getTime());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!activeSession || done) return;
    pollDemoTime();
    demoTimerRef.current = setInterval(pollDemoTime, 5000);
    return () => clearInterval(demoTimerRef.current);
  }, [activeSession, done, pollDemoTime]);

  // ── kWh accumulation timer (real seconds, actual rate) ────
  useEffect(() => {
    if (!activeSession || done) return;
    const powerKw    = parseFloat(activeSession.charger_power || activeSession.power || 22);
    const kwhPerTick = powerKw / 3600; // actual kWh per real second

    timerRef.current = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        localStorage.setItem('ev_session_elapsed', next);
        return next;
      });
      setKwh(prev => {
        const next = parseFloat((prev + kwhPerTick).toFixed(4));
        localStorage.setItem('ev_session_kwh', next);
        return next;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeSession, done]);

  // ── Mark charger as overstay once when phase transitions ──
  useEffect(() => {
    if (!activeSession || done) return;
    if (phase === 'overstay' && !overstayMarkedRef.current) {
      overstayMarkedRef.current = true;
      markSessionOverstay(activeSession.session_id).catch(() => {});
    }
  }, [phase, activeSession, done]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset refs when session changes ───────────────────────
  useEffect(() => {
    overstayMarkedRef.current = false;
    setResEndOverride(null);
    setExtResult(null);
  }, [activeSession]);

  // ── Clear localStorage when session ends ──────────────────
  useEffect(() => {
    if (done) {
      localStorage.removeItem('ev_session_elapsed');
      localStorage.removeItem('ev_session_kwh');
    }
  }, [done]);

  // ── Handle PIN submit → start session ─────────────────────
  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedRes) { setPinError('Rezervasyon seçin'); return; }
    if (pin.length !== 4) { setPinError('4 haneli PIN giriniz'); return; }
    setPinError(''); setStarting(true);
    try {
      const result = await startSession(selectedRes.id, pin);
      setActiveSession({
        session_id:     result.session_id,
        started_at:     result.started_at,
        reservation:    selectedRes,
        station_name:   selectedRes.station_name,
        charger_power:  selectedRes.charger_power,
        connector_type: selectedRes.connector_type,
        plate:          selectedRes.plate,
        brand:          selectedRes.brand,
        model:          selectedRes.model,
      });
      setKwh(0); setElapsed(0); setDone(false);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setStarting(false);
    }
  };

  // ── Handle manual stop session ────────────────────────────
  const handleStop = async () => {
    clearInterval(timerRef.current);
    clearInterval(demoTimerRef.current);
    setStopping(true);
    // overstay_minutes based on demo time vs reservation end + grace
    const overstayMins = parseFloat((overstayTotalSeconds / 60).toFixed(4));
    try {
      const res = await endSession(activeSession.session_id, kwh, overstayMins);
      setReceipt(res.receipt);
      setDone(true);
    } catch (err) {
      alert(err.message);
      setStopping(false);
    }
  };

  // ── Extension handlers ─────────────────────────────────────
  const handleCheckExtension = async () => {
    setExtCheck({ loading: true });
    try {
      const result = await checkExtension(activeSession.session_id);
      setExtCheck(result);
    } catch (e) {
      setExtCheck({ can_extend: false, reason: e.message });
    }
  };

  const handleExtend = async () => {
    setExtending(true);
    try {
      const result = await extendSession(activeSession.session_id);
      setExtResult(result);
      setExtCheck(null);
      // Update local reservation end so phase recalculates correctly
      const newEnd = new Date(result.new_end_time.replace(' ', 'T'));
      if (!isNaN(newEnd.getTime())) setResEndOverride(newEnd.getTime());
      // Reset overstay marker in case it fires again after extension
      overstayMarkedRef.current = false;
    } catch (e) {
      alert(e.message);
    } finally {
      setExtending(false);
    }
  };

  // ── No session yet — show PIN entry ──────────────────────
  if (!activeSession) {
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold text-white">Şarj Başlat</h2>

        {reservations.length === 0 ? (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-10 text-center">
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-lg font-semibold text-white mb-2">Aktif Rezervasyon Yok</h3>
            <p className="text-slate-400 text-sm mb-6">Şarj başlatmak için önce rezervasyon yapın.</p>
            <button
              onClick={() => setView('reservation')}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl hover:bg-emerald-500 text-sm font-semibold transition-colors"
            >
              Rezervasyon Yap
            </button>
          </div>
        ) : (
          <form onSubmit={handleStartSession} className="bg-slate-800 rounded-2xl border border-slate-700 p-6 space-y-5">
            <p className="text-slate-300 text-sm">
              İstasyona geldiniz mi? Rezervasyonunuzu seçip araç PIN kodunuzu girin.
            </p>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Rezervasyon</label>
              <div className="space-y-2">
                {reservations.map(r => (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRes(r)}
                    className={`cursor-pointer rounded-xl border-2 p-3 transition-all ${
                      selectedRes?.id === r.id
                        ? 'border-emerald-500 bg-emerald-900/20'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <p className="text-sm font-medium text-white">{r.station_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.reservation_date} · {r.start_time}–{r.end_time} ·{' '}
                      <span className="font-mono">{r.charger_code}</span>
                    </p>
                    <p className="text-xs text-slate-400">{r.brand} {r.model} · {r.plate}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Araç PIN Kodu</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-slate-700 border border-slate-600 text-white text-center text-3xl font-mono tracking-widest rounded-xl px-4 py-4 focus:outline-none focus:border-emerald-500"
                placeholder="••••"
              />
              <p className="text-xs text-slate-500 mt-1 text-center">
                PIN kodunuzu araç kayıt sayfasında görebilirsiniz
              </p>
            </div>

            {pinError && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {pinError}
              </div>
            )}

            <button
              type="submit"
              disabled={starting || !selectedRes || pin.length !== 4}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {starting ? 'Başlatılıyor...' : '⚡ Şarjı Başlat'}
            </button>
          </form>
        )}
      </div>
    );
  }

  // ── Completed ──────────────────────────────────────────────
  if (done) {
    const r = receipt || {};
    return (
      <div className="p-4 sm:p-8 max-w-xl mx-auto">
        <div className="bg-slate-800 rounded-2xl border border-emerald-700 p-5 sm:p-8 text-center">
          <div className="w-20 h-20 bg-emerald-900/50 rounded-full flex items-center justify-center text-4xl mx-auto mb-5">
            🎉
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Şarj Tamamlandı!</h2>
          <p className="text-slate-400 text-sm mb-6">
            {activeSession.brand} {activeSession.model} şarj edildi.
          </p>

          <div className="bg-slate-700/50 rounded-xl p-5 text-left space-y-2.5 text-sm mb-6">
            {[
              ['İstasyon',      r.station       || activeSession.station_name],
              ['Araç',          r.vehicle       || `${activeSession.brand} ${activeSession.model} (${activeSession.plate})`],
              ['Başlangıç',     r.start_time    ? new Date(r.start_time).toLocaleString('tr-TR') : '—'],
              ['Bitiş',         r.end_time      ? new Date(r.end_time).toLocaleString('tr-TR') : '—'],
              ['Tüketim',       r.kwh_consumed  ? `${r.kwh_consumed} kWh` : `${kwh.toFixed(2)} kWh`],
              ['Birim Fiyat',   r.price_per_kwh ? `${r.price_per_kwh} TL/kWh` : '—'],
              ['Gerçek Süre',   fmtTime(elapsed)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-200">{v}</span>
              </div>
            ))}
            {r.refund > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>İade (kullanılmayan süre)</span>
                <span className="font-semibold">+{r.refund} TL</span>
              </div>
            )}
            {r.overstay_minutes > 0 && (
              <div className="flex justify-between text-red-400">
                <span>⚠️ Overstay Cezası ({parseFloat(r.overstay_minutes).toFixed(1)} dk)</span>
                <span className="font-semibold">-{r.overstay_penalty} TL</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-600 pt-2.5">
              <span className="font-bold text-white">Toplam Ücret</span>
              <span className="font-bold text-emerald-400 text-xl">
                {r.total_cost ? `${r.total_cost} TL` : `${(kwh * 4).toFixed(2)} TL`}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveSession(null);
              setDone(false);
              localStorage.removeItem('ev_active_session');
              localStorage.removeItem('ev_session_elapsed');
              localStorage.removeItem('ev_session_kwh');
              setView('vehicles');
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  // ── Active Session Live View ──────────────────────────────
  const powerKw     = parseFloat(activeSession.charger_power || 22);
  const pricePerKwh = parseFloat(activeSession.reservation?.price_per_kwh || 4);
  const cost        = (kwh * pricePerKwh).toFixed(2);
  const isOverstay  = phase === 'overstay';
  const isGrace     = phase === 'grace';
  const isCharging  = phase === 'charging';

  // Overstay display values
  const overstayDispMin = Math.floor(overstayTotalSeconds / 60);
  const overstayDispSec = Math.floor(overstayTotalSeconds % 60);

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Aktif Oturum</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {activeSession.station_name} · {activeSession.brand} {activeSession.model}
          </p>
        </div>
        {isOverstay ? (
          <div className="flex items-center gap-2 bg-red-900/50 text-red-400 px-4 py-2 rounded-full text-sm font-semibold border border-red-700">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            ⚠️ Ceza Var
          </div>
        ) : isGrace ? (
          <div className="flex items-center gap-2 bg-amber-900/50 text-amber-400 px-4 py-2 rounded-full text-sm font-semibold border border-amber-700">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            ⏳ Grace Süresi
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-emerald-900/50 text-emerald-400 px-4 py-2 rounded-full text-sm font-semibold border border-emerald-700">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Şarj Oluyor
          </div>
        )}
      </div>

      {/* Grace warning banner */}
      {isGrace && (
        <div className="bg-amber-900/30 border border-amber-700 rounded-xl p-4 mb-4">
          <p className="text-amber-400 font-semibold text-sm">⏳ Rezervasyon süreniz doldu!</p>
          <p className="text-amber-300 text-xs mt-1">
            Aracınızı <strong>{graceRemainingS} saniye</strong> içinde çıkarın, aksi hâlde ceza uygulanmaya başlar.
          </p>
          {/* Grace countdown bar */}
          <div className="mt-2 w-full h-2 bg-amber-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-1000"
              style={{ width: `${(graceRemainingS / GRACE_SECONDS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Overstay warning banner */}
      {isOverstay && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-4">
          <p className="text-red-400 font-semibold text-sm">⚠️ Ceza birikmeye başladı!</p>
          <p className="text-red-300 text-xs mt-1">
            Şarjcıyı <strong>{overstayDispMin} dk {overstayDispSec} sn</strong> fazla
            kullanıyorsunuz. Ceza birikmeye devam ediyor, lütfen şarjı durdurun.
          </p>
        </div>
      )}

      {/* Animated charge bar */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-slate-300">Şarj Edilen Enerji</span>
          <span className="text-3xl font-bold text-white">{kwh.toFixed(2)} kWh</span>
        </div>
        <div className="w-full h-9 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-3"
            style={{
              width: `${Math.min((kwh / 75) * 100, 100)}%`,
              background: isOverstay
                ? 'linear-gradient(to right, #b91c1c, #ef4444)'
                : isGrace
                  ? 'linear-gradient(to right, #92400e, #f59e0b)'
                  : 'linear-gradient(to right, #10b981, #2dd4bf)',
            }}
          >
            {kwh > 5 && <span className="text-white text-xs font-bold">{kwh.toFixed(1)} kWh</span>}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 text-center">
          <p className="text-xl sm:text-2xl font-bold text-emerald-400">~{cost} TL</p>
          <p className="text-xs text-slate-400 mt-1">Tahmini Ücret</p>
        </div>

        {/* Time display — changes by phase */}
        {isCharging && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 text-center">
            <p className="text-xl sm:text-2xl font-bold text-white">
              {demoTimeMs ? fmtRemaining(timeRemainingMs) : '…'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Kalan Süre</p>
          </div>
        )}
        {isGrace && (
          <div className="bg-amber-900/20 rounded-xl border border-amber-700 p-4 sm:p-5 text-center">
            <p className="text-xl sm:text-2xl font-bold text-amber-400">{graceRemainingS}sn</p>
            <p className="text-xs text-slate-400 mt-1">Grace Süresi</p>
          </div>
        )}
        {isOverstay && (
          <div className="bg-red-900/20 rounded-xl border border-red-700 p-4 sm:p-5 text-center">
            <p className="text-xl sm:text-2xl font-bold text-red-400">
              {overstayDispMin}dk {overstayDispSec}sn
            </p>
            <p className="text-xs text-slate-400 mt-1">Fazla Kullanım</p>
          </div>
        )}

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 text-center">
          <p className="text-xl sm:text-2xl font-bold text-blue-400">{powerKw} kW</p>
          <p className="text-xs text-slate-400 mt-1">Şarj Gücü</p>
        </div>
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 sm:p-5 text-center">
          <p className="text-xl sm:text-2xl font-bold text-slate-200">{activeSession.plate}</p>
          <p className="text-xs text-slate-400 mt-1">Plaka</p>
        </div>
      </div>

      {/* Overstay penalty stats */}
      {isOverstay && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 text-center col-span-2">
            <p className="text-2xl font-bold text-red-400">-{overstayPenalty} TL</p>
            <p className="text-xs text-slate-400 mt-1">
              Birikmiş Ceza ({overstayMinutes.toFixed(1)} dk × {PENALTY_PER_MIN} TL/dk)
            </p>
          </div>
        </div>
      )}

      {/* Extension success banner */}
      {extResult && (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4 mb-3 text-sm text-emerald-300">
          ✅ Uzatma başarılı! Yeni bitiş: {new Date(extResult.new_end_time.replace(' ', 'T')).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · {extResult.cost} TL düşüldü.
        </div>
      )}

      {/* Extend button — only during charging, and if not already extended */}
      {!extResult && isCharging && (
        <button
          onClick={handleCheckExtension}
          className="w-full bg-blue-900/40 hover:bg-blue-800/60 text-blue-400 font-semibold py-3 rounded-xl border border-blue-700 transition-colors mb-3"
        >
          ⏱️ Süreyi Uzat (1 Saat)
        </button>
      )}

      {/* Stop button */}
      <button
        onClick={handleStop}
        disabled={stopping}
        className={`w-full disabled:opacity-50 font-semibold py-3 rounded-xl border transition-colors ${
          isOverstay
            ? 'bg-red-700 hover:bg-red-600 border-red-500 text-white'
            : isGrace
              ? 'bg-amber-700 hover:bg-amber-600 border-amber-500 text-white'
              : 'bg-red-900/40 hover:bg-red-800/60 border-red-700 text-red-400'
        }`}
      >
        {stopping
          ? 'Durduruluyor...'
          : isOverstay
            ? `🛑 Şarjı Durdur (${overstayPenalty} TL ceza ödenecek)`
            : isGrace
              ? '⚠️ Şarjı Durdur (grace süresinde)'
              : 'Şarjı Durdur'
        }
      </button>

      {/* Extension check / confirm modal */}
      {extCheck && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 w-full max-w-sm">
            {extCheck.loading ? (
              <p className="text-slate-300 text-center py-4">Kontrol ediliyor…</p>
            ) : extCheck.can_extend ? (
              <>
                <h3 className="text-lg font-bold text-white mb-1">⏱️ Oturumu Uzat</h3>
                <p className="text-slate-400 text-xs mb-4">Rezervasyonunuz 1 saat uzatılacak.</p>
                <div className="bg-slate-700/50 rounded-xl p-4 space-y-2.5 text-sm mb-5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Yeni Bitiş Saati</span>
                    <span className="text-white font-medium">
                      {new Date(extCheck.new_end_time.replace(' ', 'T')).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Ücret</span>
                    <span className="text-emerald-400 font-semibold">{extCheck.cost} TL</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-600 pt-2">
                    <span className="text-slate-400">Bakiye (sonra)</span>
                    <span className="text-white">{(extCheck.wallet_balance - extCheck.cost).toFixed(2)} TL</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setExtCheck(null)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleExtend}
                    disabled={extending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  >
                    {extending ? 'İşleniyor…' : 'Onayla'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-3">Uzatma Yapılamıyor</h3>
                <p className="text-slate-300 text-sm mb-5">{extCheck.reason}</p>
                <button
                  onClick={() => setExtCheck(null)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  Tamam
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
