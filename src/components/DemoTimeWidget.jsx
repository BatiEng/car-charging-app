import { useState, useEffect, useCallback } from 'react';
import { getDemoTime, addDemoTime, resetDemoTime } from '../services/api';

const PRESETS = [
  { label: '+15min',  seconds: 15 * 60 },
  { label: '+30min',  seconds: 30 * 60 },
  { label: '+59min',  seconds: 59 * 60 },
  { label: '+1hr',    seconds: 60 * 60 },
  { label: '+2hr',    seconds: 2 * 60 * 60 },
  { label: '+6hr',    seconds: 6 * 60 * 60 },
  { label: '+12hr',   seconds: 12 * 60 * 60 },
  { label: '+1day',   seconds: 24 * 60 * 60 },
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
      setFeedback(' Updated');
    } catch (e) {
      setFeedback('Error: ' + e.message);
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
      setFeedback(' Reset');
    } catch (e) {
      setFeedback('Error: ' + e.message);
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
          title="Demo time control"
        >
          <span></span>
          <span>{demoTime || '…'}</span>
          {offset !== 0 && (
            <span className="bg-indigo-500 px-1.5 py-0.5 rounded-full text-[10px]">
              +{offsetHours}hr
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="bg-white border border-gray-300 rounded-xl shadow-2xl w-72 p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Demo Time</p>
              <p className="text-gray-900 font-mono text-sm font-semibold">{demoTime || '…'}</p>
              {offset !== 0 && (
                <p className="text-indigo-400 text-[11px] mt-0.5">
                  +{offsetHours} hours ahead of real time
                </p>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white text-lg leading-none"
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
            className="w-full bg-gray-600 hover:bg-gray-500 disabled:opacity-40 text-white text-xs py-1.5 rounded-lg transition-colors"
          >
             Reset to Real Time
          </button>

          {/* Feedback */}
          {feedback && (
            <p className={`text-center text-xs mt-2 ${feedback.startsWith('') ? 'text-green-400' : 'text-red-400'}`}>
              {feedback}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
