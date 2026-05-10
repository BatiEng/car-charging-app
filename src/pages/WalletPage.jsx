import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getWallet, topUpWallet } from '../services/api';
import { useAuth } from '../context/AuthContext';

const TXN_TYPE = {
  credit: { label: 'Gelir', color: 'text-emerald-400', sign: '+' },
  debit:  { label: 'Gider', color: 'text-red-400',     sign: '-' },
};

// ── Input formatters ──────────────────────────────────────────
const formatCard = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})(?=.)/g, '$1 ');
};

const formatExpiry = (val, prev) => {
  const digits = val.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 0) return '';
  if (digits.length <= 2) {
    // Auto-add slash after 2 digits if user is typing forward
    if (digits.length === 2 && prev.length < 3) return digits + '/';
    return digits;
  }
  return digits.slice(0, 2) + '/' + digits.slice(2);
};

export default function WalletPage() {
  const { refreshUser } = useAuth();
  const [wallet,    setWallet]    = useState({ balance: 0, transactions: [] });
  const [showTopUp, setShowTopUp] = useState(false);
  const [form,      setForm]      = useState({ amount: '', card_number: '', cvv: '', expiry: '' });
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const load = () => getWallet().then(setWallet).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleTopUp = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      await new Promise(r => setTimeout(r, 2000)); // fake bank wait
      const res = await topUpWallet(parseFloat(form.amount), form.card_number.replace(/\s/g, ''));
      setSuccess(`${res.added} TL başarıyla yüklendi! Yeni bakiye: ${res.balance} TL`);
      setForm({ amount: '', card_number: '', cvv: '', expiry: '' });
      setShowTopUp(false);
      load();
      refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── "Bankadan haber bekleniyor" loading overlay ──
  const loadingOverlay = loading && createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-2xl max-w-xs w-full mx-4">
        <div className="text-5xl mb-4 animate-bounce">🏦</div>
        <p className="text-white font-semibold text-lg mb-1">Bankadan haber bekleniyor…</p>
        <p className="text-slate-400 text-sm mb-5">Lütfen bekleyin, ödemeniz işleniyor.</p>
        <div className="flex justify-center gap-1.5">
          {[0,1,2,3].map(i => (
            <div key={i} className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );

  // ── Top-up modal ──
  const topUpModal = showTopUp && createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9998] p-4"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) setShowTopUp(false); }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <span>💳</span> Bakiye Yükle
          </h3>
          <button onClick={() => setShowTopUp(false)} disabled={loading}
            className="text-slate-400 hover:text-white text-xl disabled:opacity-30">✕</button>
        </div>

        <form onSubmit={handleTopUp} className="p-5 space-y-4">
          {/* Card number */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Kart Numarası</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.card_number}
              onChange={(e) => setForm(f => ({ ...f, card_number: formatCard(e.target.value) }))}
              required maxLength={19}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm font-mono tracking-widest focus:outline-none focus:border-emerald-500"
              placeholder="1234 5678 9012 3456"
            />
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Son Kullanma</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.expiry}
                onChange={(e) => {
                  const next = formatExpiry(e.target.value, form.expiry);
                  setForm(f => ({ ...f, expiry: next }));
                }}
                required maxLength={5}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                placeholder="AA/YY"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">CVV</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.cvv}
                onChange={(e) => setForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                required maxLength={4}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                placeholder="123"
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Yüklenecek Miktar (TL)</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              required min={1} max={5000} step={1}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500"
              placeholder="500"
            />
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-lg p-3 text-red-300 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
              Ödemeyi Onayla
            </button>
            <button type="button" onClick={() => setShowTopUp(false)} disabled={loading}
              className="flex-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white font-semibold py-2.5 rounded-lg transition-colors">
              İptal
            </button>
          </div>
          <p className="text-xs text-slate-500 text-center">Bu ödeme simülasyondur — kart bilgileri doğrulanmaz</p>
        </form>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto space-y-6">
      {loadingOverlay}
      {topUpModal}

      <h2 className="text-2xl font-bold text-white">Cüzdan</h2>

      {/* Balance card */}
      <div className="bg-gradient-to-br from-emerald-700 to-teal-800 rounded-2xl p-6 shadow-xl">
        <p className="text-emerald-200 text-sm mb-1">Mevcut Bakiye</p>
        <p className="text-4xl font-bold text-white">
          {wallet.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
          <span className="text-xl ml-1">TL</span>
        </p>
        {wallet.balance < 200 && (
          <p className="mt-2 text-yellow-300 text-sm">⚠️ Bakiyeniz 200 TL altında – lütfen yükleyin</p>
        )}
        <button
          onClick={() => { setShowTopUp(true); setError(''); setSuccess(''); }}
          className="mt-4 bg-white/20 hover:bg-white/30 text-white font-semibold px-6 py-2 rounded-lg transition-colors text-sm"
        >
          + Bakiye Yükle
        </button>
      </div>

      {success && (
        <div className="bg-emerald-900/40 border border-emerald-700 rounded-lg p-3 text-emerald-300 text-sm">
          ✅ {success}
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700">
        <div className="px-5 py-4 border-b border-slate-700">
          <h3 className="text-white font-semibold">İşlem Geçmişi</h3>
        </div>
        {wallet.transactions.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">Henüz işlem yok</p>
        ) : (
          <div className="divide-y divide-slate-700">
            {wallet.transactions.map(tx => {
              const t = TXN_TYPE[tx.type] || { label: tx.type, color: 'text-white', sign: '' };
              return (
                <div key={tx.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm text-white">{tx.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(tx.created_at).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold text-sm ${t.color}`}>
                      {t.sign}{Math.abs(tx.amount).toFixed(2)} TL
                    </p>
                    <p className="text-xs text-slate-500">Bakiye: {parseFloat(tx.balance_after).toFixed(2)} TL</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
