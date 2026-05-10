import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { register as apiRegister } from '../services/api';

export default function Login() {
  const { login } = useAuth();
  const [tab, setTab]       = useState('login'); // 'login' | 'register'
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

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
          {['login', 'register'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {tab === 'register' && (
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
          )}
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
            {loading ? 'Lütfen bekleyin...' : tab === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        </form>

        {/* Demo hints */}
        <div className="px-6 pb-6">
          <p className="text-xs text-slate-500 text-center mb-2">Demo hesaplar:</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div className="bg-slate-800 rounded p-2">
              <p className="text-slate-300 font-medium">Admin</p>
              <p>admin@ev.com</p>
              <p>Admin123!</p>
            </div>
            <div className="bg-slate-800 rounded p-2">
              <p className="text-slate-300 font-medium">Sürücü</p>
              <p>driver@ev.com</p>
              <p>Driver123!</p>
            </div>
            <div className="bg-slate-800 rounded p-2">
              <p className="text-slate-300 font-medium">Teknisyen</p>
              <p>tech@ev.com</p>
              <p>Tech123!</p>
            </div>
            <div className="bg-slate-800 rounded p-2">
              <p className="text-slate-300 font-medium">Operatör</p>
              <p>op1@ev.com</p>
              <p>Operator1!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
