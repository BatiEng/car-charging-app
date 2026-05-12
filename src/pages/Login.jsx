import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { register as apiRegister } from '../services/api';

const DEMO_ACCOUNTS = [
  { role: 'admin',      label: 'Admin',      icon: '🛡️', email: 'admin@ev.com',  password: 'Admin123!',    color: 'from-purple-600 to-purple-700',  border: 'border-purple-500', text: 'text-purple-300' },
  { role: 'operator',   label: 'Operatör',   icon: '🏢', email: 'op1@ev.com',    password: 'Operator1!',   color: 'from-blue-600 to-blue-700',      border: 'border-blue-500',   text: 'text-blue-300' },
  { role: 'technician', label: 'Teknisyen',  icon: '🔧', email: 'tech@ev.com',   password: 'Tech123!',     color: 'from-amber-600 to-amber-700',    border: 'border-amber-500',  text: 'text-amber-300' },
  { role: 'driver',     label: 'Sürücü',     icon: '🚗', email: 'driver@ev.com', password: 'Driver123!',   color: 'from-emerald-600 to-emerald-700',border: 'border-emerald-500',text: 'text-emerald-300' },
];

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab]           = useState('demo'); // 'demo' | 'login' | 'register'
  const [form, setForm]         = useState({ name: '', email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null); // role string

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  // Quick-login with demo account
  const handleDemoLogin = async (account) => {
    setError('');
    setLoading(true);
    setSelected(account.role);
    try {
      await login(account.email, account.password);
    } catch (err) {
      setError(err.message);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        await apiRegister(form.name, form.email, form.password);
        await login(form.email, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-center">
          <div className="text-4xl mb-2">⚡</div>
          <h1 className="text-2xl font-bold text-white">EV Charge Network</h1>
          <p className="text-emerald-100 text-sm mt-1">İzmir Şarj İstasyonu Yönetimi</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          {[
            { key: 'demo',     label: '🚀 Demo Giriş' },
            { key: 'login',    label: 'Giriş Yap' },
            { key: 'register', label: 'Kayıt Ol' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(''); setSelected(null); }}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Demo tab ── */}
        {tab === 'demo' && (
          <div className="p-6">
            <p className="text-slate-400 text-xs text-center mb-4">
              Rol seçin ve otomatik giriş yapın
            </p>

            <div className="grid grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.role}
                  onClick={() => handleDemoLogin(acc)}
                  disabled={loading}
                  className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all
                    ${selected === acc.role
                      ? `bg-gradient-to-br ${acc.color} ${acc.border} scale-95 opacity-80`
                      : `bg-slate-800 border-slate-700 hover:${acc.border} hover:bg-slate-750`
                    }
                    disabled:opacity-50 disabled:cursor-wait`}
                >
                  <span className="text-3xl">{acc.icon}</span>
                  <span className={`text-sm font-semibold ${selected === acc.role ? 'text-white' : acc.text}`}>
                    {acc.label}
                  </span>
                  {selected === acc.role && loading && (
                    <span className="text-[10px] text-white/70 animate-pulse">Giriş yapılıyor…</span>
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Login tab ── */}
        {tab === 'login' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">E-posta</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                placeholder="ornek@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Şifre</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Lütfen bekleyin...' : 'Giriş Yap'}
            </button>
          </form>
        )}

        {/* ── Register tab ── */}
        {tab === 'register' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Ad Soyad</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                placeholder="Adınız Soyadınız"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">E-posta</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                placeholder="ornek@email.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Şifre</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              {loading ? 'Lütfen bekleyin...' : 'Kayıt Ol'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
