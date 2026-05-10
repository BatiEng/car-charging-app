import { useState, useEffect } from 'react';
import { adminGet, adminUpdateUser } from '../services/api';

const TABS = [
  { key: 'users',        label: 'Kullanıcılar', icon: '👤' },
  { key: 'stations',     label: 'İstasyonlar',  icon: '🏪' },
  { key: 'reservations', label: 'Rezervasyonlar', icon: '📅' },
  { key: 'sessions',     label: 'Oturumlar',    icon: '⚡' },
  { key: 'revenue',      label: 'Gelir',        icon: '💰' },
];

const STATUS_COLOR = {
  pending:   'bg-yellow-900/40 text-yellow-300',
  active:    'bg-blue-900/40 text-blue-300',
  completed: 'bg-emerald-900/40 text-emerald-300',
  cancelled: 'bg-red-900/40 text-red-300',
  available: 'bg-emerald-900/40 text-emerald-300',
  occupied:  'bg-blue-900/40 text-blue-300',
  offline:   'bg-red-900/40 text-red-300',
  active_s:  'bg-emerald-900/40 text-emerald-300',
  inactive:  'bg-slate-700 text-slate-300',
  maintenance: 'bg-orange-900/40 text-orange-300',
};

function Badge({ v }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[v] || 'bg-slate-700 text-slate-300'}`}>
      {v}
    </span>
  );
}

function Table({ cols, rows }) {
  if (!rows || rows.length === 0)
    return <p className="text-center text-slate-400 py-8 text-sm">Veri yok</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            {cols.map(c => (
              <th key={c.key} className="text-left px-4 py-2 text-slate-400 font-medium whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-800/50">
              {cols.map(c => (
                <td key={c.key} className="px-4 py-2 text-slate-200 whitespace-nowrap">
                  {c.render ? c.render(row[c.key], row) : (row[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sub-views ────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [edit, setEdit]   = useState(null); // { id, role, wallet_balance }
  const [msg, setMsg]     = useState('');

  useEffect(() => { adminGet('users').then(setUsers).catch(() => {}); }, []);

  const handleSave = async () => {
    try {
      await adminUpdateUser(edit);
      setMsg('Güncellendi ✓');
      setEdit(null);
      adminGet('users').then(setUsers);
    } catch (e) { setMsg(e.message); }
  };

  return (
    <div>
      {msg && <p className="mb-3 text-sm text-emerald-400">{msg}</p>}
      <Table
        cols={[
          { key: 'id',             label: 'ID' },
          { key: 'name',           label: 'Ad' },
          { key: 'email',          label: 'E-posta' },
          { key: 'role',           label: 'Rol', render: v => <Badge v={v} /> },
          { key: 'wallet_balance', label: 'Bakiye', render: v => `${parseFloat(v).toFixed(2)} TL` },
          { key: 'created_at',     label: 'Kayıt', render: v => new Date(v).toLocaleDateString('tr-TR') },
          { key: 'id', label: 'Düzenle', render: (_, row) => (
            <button
              onClick={() => setEdit({ id: row.id, role: row.role, wallet_balance: row.wallet_balance })}
              className="text-xs text-emerald-400 hover:underline"
            >
              Düzenle
            </button>
          )},
        ]}
        rows={users}
      />
      {edit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-80 space-y-4">
            <h3 className="text-white font-semibold">Kullanıcı Düzenle</h3>
            <div>
              <label className="text-xs text-slate-400">Rol</label>
              <select
                value={edit.role}
                onChange={e => setEdit(ed => ({ ...ed, role: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              >
                {['driver','operator','technician','admin'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Cüzdan Bakiyesi (TL)</label>
              <input
                type="number"
                value={edit.wallet_balance}
                onChange={e => setEdit(ed => ({ ...ed, wallet_balance: e.target.value }))}
                className="w-full mt-1 bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-semibold">Kaydet</button>
              <button onClick={() => setEdit(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm">İptal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StationsTab() {
  const [rows, setRows] = useState([]);
  useEffect(() => { adminGet('stations').then(setRows).catch(() => {}); }, []);
  return (
    <Table
      cols={[
        { key: 'id',              label: 'ID' },
        { key: 'name',            label: 'İstasyon' },
        { key: 'address',         label: 'Adres' },
        { key: 'status',          label: 'Durum', render: v => <Badge v={v} /> },
        { key: 'operator_name',   label: 'Operatör' },
        { key: 'charger_count',   label: 'Şarjcı' },
        { key: 'available_count', label: 'Müsait' },
      ]}
      rows={rows}
    />
  );
}

function ReservationsTab() {
  const [rows, setRows] = useState([]);
  useEffect(() => { adminGet('reservations').then(setRows).catch(() => {}); }, []);
  return (
    <Table
      cols={[
        { key: 'id',           label: 'ID' },
        { key: 'user_name',    label: 'Kullanıcı' },
        { key: 'station_name', label: 'İstasyon' },
        { key: 'reservation_date', label: 'Tarih' },
        { key: 'start_time',   label: 'Başlangıç' },
        { key: 'end_time',     label: 'Bitiş' },
        { key: 'plate',        label: 'Plaka' },
        { key: 'estimated_cost', label: 'Tutar', render: v => `${parseFloat(v).toFixed(2)} TL` },
        { key: 'status',       label: 'Durum', render: v => <Badge v={v} /> },
      ]}
      rows={rows}
    />
  );
}

function SessionsTab() {
  const [rows, setRows] = useState([]);
  useEffect(() => { adminGet('sessions').then(setRows).catch(() => {}); }, []);
  return (
    <Table
      cols={[
        { key: 'id',           label: 'ID' },
        { key: 'user_name',    label: 'Kullanıcı' },
        { key: 'station_name', label: 'İstasyon' },
        { key: 'plate',        label: 'Plaka' },
        { key: 'start_time',   label: 'Başlangıç', render: v => v ? new Date(v).toLocaleString('tr-TR') : '—' },
        { key: 'end_time',     label: 'Bitiş',     render: v => v ? new Date(v).toLocaleString('tr-TR') : '—' },
        { key: 'kwh_consumed', label: 'kWh',        render: v => v ? `${parseFloat(v).toFixed(2)}` : '—' },
        { key: 'total_cost',   label: 'Tutar',      render: v => v ? `${parseFloat(v).toFixed(2)} TL` : '—' },
        { key: 'status',       label: 'Durum',      render: v => <Badge v={v} /> },
        { key: 'receipt_data', label: 'Makbuz',     render: v => v ? (
          <button
            className="text-xs text-emerald-400 hover:underline"
            onClick={() => alert(JSON.stringify(JSON.parse(v), null, 2))}
          >
            Görüntüle
          </button>
        ) : '—' },
      ]}
      rows={rows}
    />
  );
}

function RevenueTab() {
  const [data, setData] = useState(null);
  useEffect(() => { adminGet('revenue').then(setData).catch(() => {}); }, []);
  if (!data) return <p className="text-slate-400 py-8 text-center text-sm">Yükleniyor...</p>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-4">
          <p className="text-emerald-300 text-sm">Toplam Gelir</p>
          <p className="text-2xl font-bold text-white">{parseFloat(data.total).toFixed(2)} TL</p>
        </div>
      </div>

      <div>
        <h4 className="text-white font-semibold mb-3">Aylık Gelir</h4>
        <Table
          cols={[
            { key: 'month',    label: 'Ay' },
            { key: 'sessions', label: 'Oturum' },
            { key: 'revenue',  label: 'Gelir', render: v => `${parseFloat(v).toFixed(2)} TL` },
          ]}
          rows={data.monthly}
        />
      </div>

      <div>
        <h4 className="text-white font-semibold mb-3">İstasyona Göre Gelir</h4>
        <Table
          cols={[
            { key: 'name',     label: 'İstasyon' },
            { key: 'sessions', label: 'Oturum' },
            { key: 'revenue',  label: 'Gelir', render: v => `${parseFloat(v).toFixed(2)} TL` },
          ]}
          rows={data.byStation}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function AdminDashboard() {
  const [tab, setTab] = useState('users');

  const VIEWS = { users: UsersTab, stations: StationsTab, reservations: ReservationsTab, sessions: SessionsTab, revenue: RevenueTab };
  const View = VIEWS[tab] || UsersTab;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Admin Paneli</h2>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-emerald-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4">
          <View />
        </div>
      </div>
    </div>
  );
}
