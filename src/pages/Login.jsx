import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { register as apiRegister } from '../services/api';

const DEMO_ACCOUNTS = [
  { role: 'admin',      label: 'Admin',      badge: 'bg-purple-100 text-purple-700', email: 'admin@ev.com',  password: 'Admin123!'  },
  { role: 'operator',   label: 'Operator',   badge: 'bg-blue-100 text-blue-700',     email: 'op1@ev.com',    password: 'Operator1!' },
  { role: 'technician', label: 'Technician', badge: 'bg-amber-100 text-amber-700',   email: 'tech@ev.com',   password: 'Tech123!'   },
  { role: 'driver',     label: 'Driver',     badge: 'bg-green-100 text-green-700',   email: 'driver@ev.com', password: 'Driver123!' },
];

const BoltIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab]           = useState('demo');
  const [form, setForm]         = useState({ name: '', email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

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

  const inputClass = "w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 transition";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

        {/* Header */}
        <div className="bg-blue-600 px-8 py-7 text-center">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <BoltIcon />
          </div>
          <h1 className="text-xl font-bold text-white">EV Charge Network</h1>
          <p className="text-blue-100 text-sm mt-1">Izmir Charging Station Management</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white">
          {[
            { key: 'demo',     label: 'Demo Login' },
            { key: 'login',    label: 'Sign In' },
            { key: 'register', label: 'Register' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(''); setSelected(null); }}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Demo tab ── */}
        {tab === 'demo' && (
          <div className="p-6">
            <p className="text-gray-500 text-xs text-center mb-4">
              Select a role and sign in automatically
            </p>

            <div className="grid grid-cols-2 gap-3">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.role}
                  onClick={() => handleDemoLogin(acc)}
                  disabled={loading}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all text-left
                    ${selected === acc.role
                      ? 'border-blue-500 bg-blue-50 scale-95'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                    }
                    disabled:opacity-50 disabled:cursor-wait`}
                >
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${acc.badge}`}>
                    {acc.label}
                  </span>
                  <span className="text-xs text-gray-400 font-mono truncate w-full text-center">{acc.email}</span>
                  {selected === acc.role && loading && (
                    <span className="text-[10px] text-blue-500 animate-pulse">Signing in...</span>
                  )}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ── Login tab ── */}
        {tab === 'login' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                className={inputClass}
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Please wait...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── Register tab ── */}
        {tab === 'register' && (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                required
                className={inputClass}
                placeholder="Your Full Name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                required
                className={inputClass}
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                minLength={6}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? 'Please wait...' : 'Register'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
