import { useState, useEffect, useCallback } from 'react';
import { getDemoTime, addDemoTime, resetDemoTime } from '../services/api';

const PRESETS = [
  { label: '+15dk',  seconds: 15 * 60 },
  { label: '+30dk',  seconds: 30 * 60 },
  { label: '+59dk',  seconds: 59 * 60 },
  { label: '+1sa',   seconds: 60 * 60 },
  { label: '+2sa',   seconds: 2 * 60 * 60 },
  { label: '+6sa',   seconds: 6 * 60 * 60 },
  { label: '+12sa',  seconds: 12 * 60 * 60 },
  { label: '+1gün',  seconds: 24 * 60 * 60 },
];

export default function DemoTimeWidget() {
  const [open,       setOpen]       = useState(false);
  const [demoTime,   setDemoTime]   = useState('');
  const [offset,     setOffset]     = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [feedback,   setFeedback]   = useState('');

  const refresh = useCallback(async () => {
    try {
      const d = await getDemoTime();
      setDemoTime(d.demo_time_tr);
      setOffset(d.offset_seconds);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  async function handlePreset(seconds) {
    setLoading(true);
    setFeedback('');
    try {
      const d = await addDemoTime(seconds);
      setDemoTime(d.demo_time_tr);
      setOffset(d.offset_seconds);
      setFeedback('✓ Güncellendi');
    } catch (e) {
      setFeedback('Hata: ' + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(''), 2000);
    }
  }

  async function handleReset() {
    setLoading(true);
    setFeedback('');
    try {
      const d = await resetDemoTime();
      setDemoTime(d.demo_time_tr);
      setOffset(0);
      setFeedback('✓ Sıfırlandı');
    } catch (e) {
      setFeedback('Hata: ' + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(''), 2000);
    }
  }

  const offsetHours = Math.round(offset / 3600);

  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 z-50">
      {/* Collapsed pill */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs font-mono px-3 py-1.5 rounded-full shadow-lg transition-colors"
          title="Demo zaman kontrolü"
        >
          <span>🕐</span>
          <span>{demoTime || '…'}</span>
          {offset !== 0 && (
            <span className="bg-indigo-500 px-1.5 py-0.5 rounded-full text-[10px]">
              +{offsetHours}sa
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-72 p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider">Demo Saati</p>
              <p className="text-white font-mono text-sm font-semibold">{demoTime || '…'}</p>
              {offset !== 0 && (
                <p className="text-indigo-400 text-[11px] mt-0.5">
                  Gerçek saatten +{offsetHours} saat ilerde
                </p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white text-lg leading-none"
            >×</button>
          </div>

          {/* Preset buttons */}
          <div className="grid grid-cols-4 gap-1.5 mb-3">
            {PRESETS.map(({ label, seconds }) => (
              <button
                key={label}
                onClick={() => handlePreset(seconds)}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Reset */}
          <button
            onClick={handleReset}
            disabled={loading || offset === 0}
            className="w-full bg-slate-600 hover:bg-slate-500 disabled:opacity-40 text-white text-xs py-1.5 rounded-lg transition-colors"
          >
            🔄 Gerçek Saate Döndür
          </button>

          {/* Feedback */}
          {feedback && (
            <p className={`text-center text-xs mt-2 ${feedback.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
              {feedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
