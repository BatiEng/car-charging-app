import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import {
  adminGet, adminUpdateUser, adminUpdateStation, adminUpdateReservation,
  adminDeleteUser, getStationUsage,
  createStation, createCharger, updateCharger, deleteCharger, getStations,
  getMyIssues, patchIssue, getTechnicians,
} from '../services/api';

import { MAP_CENTER, CONNECTORS } from '../constants';

const PAGE_META = {
  users:        { label: 'Kullanıcılar',      icon: '', desc: 'Tüm kullanıcıları görüntüle ve düzenle' },
  stations:     { label: 'İstasyonlar',       icon: '', desc: 'Şarj istasyonlarını yönet, yeni istasyon ekle' },
  reservations: { label: 'Rezervasyonlar',    icon: '', desc: 'Tüm rezervasyonları görüntüle ve güncelle' },
  sessions:     { label: 'Şarj Oturumları',   icon: '', desc: 'Tamamlanan şarj oturumları ve makbuzlar' },
  revenue:      { label: 'Gelir Raporu',      icon: '', desc: 'Aylık ve istasyona göre gelir analizi' },
  vehicles:     { label: 'Araçlar',           icon: '', desc: 'Kullanıcıların kayıtlı araçları' },
  issues:       { label: 'Arızalar & Sorunlar', icon: '', desc: 'Kullanıcıların bildirdiği istasyon sorunları' },
};

const STATUS_COLOR = {
  pending:'bg-yellow-900/40 text-yellow-300', active:'bg-blue-900/40 text-blue-300',
  completed:'bg-blue-900/40 text-blue-300', cancelled:'bg-red-900/40 text-red-300',
  available:'bg-blue-900/40 text-blue-300', occupied:'bg-blue-900/40 text-blue-300',
  offline:'bg-red-900/40 text-red-300', inactive:'bg-gray-100 text-gray-700',
  maintenance:'bg-orange-900/40 text-orange-300',
  open:'bg-red-900/40 text-red-300', in_progress:'bg-yellow-900/40 text-yellow-300',
  resolved:'bg-blue-900/40 text-blue-300',
};
const STATION_STATUSES = ['active','inactive','maintenance'];
const STATUS_LABELS    = { active:' Aktif', inactive:' Pasif', maintenance:' Bakımda' };
const MINI_MAP_STYLE   = { width:'100%', height:'280px' };
const MINI_MAP_OPTIONS = { disableDefaultUI:true, clickableIcons:false };
const EMPTY_CHARGER    = { charger_code:'', type:'AC', power:'', connector_type:'', price_per_kwh:'3.50' };

function Badge({ v }) {
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[v]||'bg-gray-100 text-gray-700'}`}>{v}</span>;
}

function Table({ cols, rows }) {
  if (!rows?.length) return <p className="text-center text-gray-500 py-8 text-sm">Veri yok</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-gray-200">
          {cols.map(c => <th key={c.key+c.label} className="text-left px-4 py-2 text-gray-500 font-medium whitespace-nowrap">{c.label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row,i) => (
            <tr key={i} className="hover:bg-gray-50/50">
              {cols.map(c => <td key={c.key+c.label} className="px-4 py-2 text-gray-800 whitespace-nowrap">{c.render?c.render(row[c.key],row):(row[c.key]??'—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({ title, onClose, children, wide=false }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className={`bg-white border border-gray-200 rounded-lg shadow-2xl w-full overflow-hidden ${wide?'max-w-4xl':'max-w-md'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none"></button>
        </div>
        <div className="p-5 overflow-y-auto max-h-[82vh]">{children}</div>
      </div>
    </div>,
    document.body
  );
}

//  Shared Charger List (used in both create & edit) 
function ChargerList({ chargers, onChange, onDelete }) {
  const update = (idx, field, val) =>
    onChange(chargers.map((c,i) => i===idx ? {...c,[field]:val} : c));

  return (
    <div className="space-y-3">
      {chargers.map((ch, idx) => (
        <div key={ch.id??`new-${idx}`} className="bg-gray-50 border border-gray-300 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              {ch._new ? `Yeni Şarjcı #${idx+1}` : `Şarjcı #${idx+1} (ID: ${ch.id})`}
            </span>
            <button type="button" onClick={()=>onDelete(idx,ch)}
              className="text-xs text-red-400 hover:text-red-300"> Kaldır</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400">Kod *</label>
              <input value={ch.charger_code}
                onChange={e=>update(idx,'charger_code',e.target.value.toUpperCase())}
                placeholder="örn. ST1-01"
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"/>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Tip</label>
              <select value={ch.type} onChange={e=>update(idx,'type',e.target.value)}
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs">
                <option value="AC">AC</option>
                <option value="DC">DC</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Güç (kW) *</label>
              <input type="number" min="1" value={ch.power}
                onChange={e=>update(idx,'power',e.target.value)}
                placeholder="22"
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"/>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">TL/kWh</label>
              <input type="number" min="0" step="0.01" value={ch.price_per_kwh}
                onChange={e=>update(idx,'price_per_kwh',e.target.value)}
                className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"/>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-400">Konektör *</label>
            <select value={ch.connector_type} onChange={e=>update(idx,'connector_type',e.target.value)}
              className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs">
              <option value="">Seçin…</option>
              {CONNECTORS.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

//  Shared Station Form (create + edit) 
function StationFormModal({ title, station, stationChargers=[], isLoaded, users=[], onClose, onSaved }) {
  const isEdit = !!station;

  const [form, setForm] = useState(station ? {
    id:          station.id,
    name:        station.name,
    address:     station.address,
    status:      station.status,
    lat:         station.lat,
    lng:         station.lng,
    operator_id: station.operator_id ?? '',
  } : { name:'', address:'', status:'active', lat:null, lng:null, operator_id:'' });

  // Chargers: existing ones have id; new ones have _new:true
  const [chargers,    setChargers]    = useState(
    isEdit
      ? stationChargers.map(c=>({...c, _new:false}))
      : [{ ...EMPTY_CHARGER, _new:true }]
  );
  const [deletedIds,  setDeletedIds]  = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState('');

  const handleMapClick = e => setForm(f=>({...f, lat:e.latLng.lat(), lng:e.latLng.lng()}));

  const handleAddCharger = () => setChargers(cs=>[...cs, {...EMPTY_CHARGER, _new:true}]);

  const handleDeleteCharger = (idx, ch) => {
    if (!ch._new && ch.id) setDeletedIds(ids=>[...ids, ch.id]);
    setChargers(cs=>cs.filter((_,i)=>i!==idx));
  };

  const handleSave = async () => {
    if (!form.name || !form.address) { setErr('Ad ve adres zorunlu'); return; }
    if (!form.lat || !form.lng)      { setErr('Haritadan konum seçin'); return; }

    const filled = chargers.filter(c=>c.charger_code||c.power||c.connector_type);
    for (const c of filled) {
      if (!c.charger_code||!c.power||!c.connector_type) { setErr('Tüm şarjcı alanlarını doldurun'); return; }
    }

    setSaving(true); setErr('');
    try {
      if (isEdit) {
        // Update station
        await adminUpdateStation({ id:form.id, name:form.name, address:form.address, status:form.status, lat:form.lat, lng:form.lng });
        // Delete removed chargers
        for (const id of deletedIds) await deleteCharger(id);
        // Update existing chargers
        for (const c of filled.filter(c=>!c._new)) {
          await updateCharger(c.id, { charger_code:c.charger_code, type:c.type, power:parseFloat(c.power), connector_type:c.connector_type, price_per_kwh:parseFloat(c.price_per_kwh)||3.50 });
        }
        // Create new chargers
        for (const c of filled.filter(c=>c._new)) {
          await createCharger({ station_id:form.id, charger_code:c.charger_code, type:c.type, power:parseFloat(c.power), connector_type:c.connector_type, price_per_kwh:parseFloat(c.price_per_kwh)||3.50 });
        }
      } else {
        // Create station
        const res = await createStation({ name:form.name, address:form.address, status:form.status, lat:form.lat, lng:form.lng, operator_id:form.operator_id||null });
        for (const c of filled) {
          await createCharger({ station_id:res.id, charger_code:c.charger_code, type:c.type, power:parseFloat(c.power), connector_type:c.connector_type, price_per_kwh:parseFloat(c.price_per_kwh)||3.50 });
        }
      }
      onSaved();
      onClose();
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/*  Sol: Form + Şarjcılar  */}
        <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
          <div>
            <label className="text-xs text-gray-500">İstasyon Adı *</label>
            <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}
              placeholder="örn. Alsancak Şarj Noktası"
              className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div>
            <label className="text-xs text-gray-500">Adres *</label>
            <input value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))}
              placeholder="örn. Alsancak, İzmir"
              className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Durum</label>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}
                className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm">
                {STATION_STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Operatör</label>
              <select value={form.operator_id} onChange={e=>setForm(f=>({...f,operator_id:e.target.value}))}
                className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm">
                <option value="">— Atanmamış —</option>
                {users.filter(u=>u.role==='operator').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Enlem</label>
              <input readOnly value={form.lat??''} placeholder="Haritadan seç"
                className="w-full mt-1 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm cursor-not-allowed"/>
            </div>
            <div>
              <label className="text-xs text-gray-500">Boylam</label>
              <input readOnly value={form.lng??''} placeholder="Haritadan seç"
                className="w-full mt-1 bg-gray-50 border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm cursor-not-allowed"/>
            </div>
          </div>

          {/* Şarjcılar */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide"> Şarj Üniteleri</p>
              <button type="button" onClick={handleAddCharger}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-blue-400 px-2 py-1 rounded-lg transition-colors">
                + Ekle
              </button>
            </div>
            <ChargerList
              chargers={chargers}
              onChange={setChargers}
              onDelete={handleDeleteCharger}
            />
            {chargers.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-3">Henüz şarjcı yok. "+ Ekle" ile ekleyin.</p>
            )}
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold">
            {saving ? 'Kaydediliyor…' : isEdit ? ' Değişiklikleri Kaydet' : ' İstasyon Oluştur'}
          </button>
        </div>

        {/*  Sağ: Harita  */}
        <div>
          <p className="text-xs text-gray-500 mb-2"> Haritaya tıklayarak konum {isEdit?'güncelleyin':'seçin'}</p>
          {!isLoaded ? (
            <div className="flex items-center justify-center bg-gray-100 rounded-xl h-72">
              <p className="text-gray-500 text-sm animate-pulse">Harita yükleniyor…</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-gray-300">
              <GoogleMap
                mapContainerStyle={MINI_MAP_STYLE}
                center={(form.lat&&form.lng)?{lat:parseFloat(form.lat),lng:parseFloat(form.lng)}:MAP_CENTER}
                zoom={12}
                options={MINI_MAP_OPTIONS}
                onClick={handleMapClick}
              >
                {form.lat && form.lng && (
                  <MarkerF position={{lat:parseFloat(form.lat),lng:parseFloat(form.lng)}}/>
                )}
              </GoogleMap>
            </div>
          )}
          {form.lat && (
            <p className="text-xs text-blue-400 mt-2">
               Konum: {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

//  Users Tab 
function UsersTab() {
  const [users,    setUsers]    = useState([]);
  const [stations, setStations] = useState([]);
  const [edit,     setEdit]     = useState(null);
  const [msg,      setMsg]      = useState('');

  useEffect(() => {
    adminGet('users').then(setUsers).catch(()=>{});
    getStations().then(setStations).catch(()=>{});
  }, []);

  const handleSave = async () => {
    try {
      await adminUpdateUser(edit);
      setMsg('Güncellendi ');
      setEdit(null);
      adminGet('users').then(setUsers);
    } catch(e) { setMsg(e.message); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`"${row.name}" kullanıcısını silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz.`)) return;
    try {
      await adminDeleteUser(row.id);
      setMsg(`${row.name} silindi.`);
      adminGet('users').then(setUsers);
    } catch(e) { setMsg(e.message); }
  };

  return (
    <div>
      {msg && <p className="mb-3 text-sm text-blue-400">{msg}</p>}
      <Table
        cols={[
          { key:'id',             label:'ID' },
          { key:'name',           label:'Ad' },
          { key:'email',          label:'E-posta' },
          { key:'role',           label:'Rol',    render:v=><Badge v={v}/> },
          { key:'wallet_balance', label:'Bakiye', render:v=>`${parseFloat(v).toFixed(2)} TL` },
          { key:'created_at',     label:'Kayıt',  render:v=>new Date(v).toLocaleDateString('tr-TR') },
          { key:'id', label:'İşlemler', render:(_,row)=>(
            <div className="flex gap-2">
              <button onClick={()=>setEdit({id:row.id,role:row.role,wallet_balance:row.wallet_balance,station_id:''})}
                className="text-xs text-blue-400 hover:underline">Düzenle</button>
              <button onClick={()=>handleDelete(row)}
                className="text-xs text-red-400 hover:underline">Sil</button>
            </div>
          )},
        ]}
        rows={users}
      />
      {edit && (
        <Modal title="Kullanıcı Düzenle" onClose={()=>setEdit(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500">Rol</label>
              <select value={edit.role} onChange={e=>setEdit(ed=>({...ed,role:e.target.value,station_id:''}))}
                className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm">
                {['driver','operator','technician','admin'].map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {edit.role==='operator' && (
              <div>
                <label className="text-xs text-gray-500">Atanacak İstasyon</label>
                <select value={edit.station_id} onChange={e=>setEdit(ed=>({...ed,station_id:e.target.value}))}
                  className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm">
                  <option value="">— İstasyon seçin —</option>
                  {stations.map(s=><option key={s.id} value={s.id}>{s.name} ({s.address})</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Seçilen istasyonun operatörü bu kullanıcı olarak atanır.</p>
              </div>
            )}
            <div>
              <label className="text-xs text-gray-500">Cüzdan Bakiyesi (TL)</label>
              <input type="number" value={edit.wallet_balance}
                onChange={e=>setEdit(ed=>({...ed,wallet_balance:e.target.value}))}
                className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"/>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold">Kaydet</button>
              <button onClick={()=>setEdit(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-white py-2 rounded-lg text-sm">İptal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

//  Stations Tab 
function StationsTab({ isLoaded }) {
  const [rows,     setRows]     = useState([]);
  const [users,    setUsers]    = useState([]);
  const [editing,  setEditing]  = useState(null); // station row for edit
  const [creating, setCreating] = useState(false);
  const [msg,      setMsg]      = useState('');

  const load = () => adminGet('stations').then(setRows).catch(()=>{});
  useEffect(() => {
    load();
    adminGet('users').then(setUsers).catch(()=>{});
  }, []);

  const handleSaved = () => { setMsg('Kaydedildi '); load(); };

  return (
    <div>
      {msg && <p className="mb-3 text-sm text-blue-400">{msg}</p>}

      <div className="flex justify-end mb-3">
        <button onClick={()=>{ setCreating(true); setMsg(''); }}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          + Yeni İstasyon
        </button>
      </div>

      <Table
        cols={[
          { key:'id',              label:'ID' },
          { key:'name',            label:'İstasyon' },
          { key:'address',         label:'Adres' },
          { key:'status',          label:'Durum',   render:v=><Badge v={v}/> },
          { key:'operator_name',   label:'Operatör' },
          { key:'charger_count',   label:'Şarjcı' },
          { key:'available_count', label:'Müsait' },
          { key:'id', label:'Düzenle', render:(_,row)=>(
            <button onClick={()=>setEditing(row)}
              className="text-xs text-blue-400 hover:underline">Düzenle</button>
          )},
        ]}
        rows={rows}
      />

      {editing && (
        <StationFormModal
          title={`İstasyon Düzenle — ${editing.name}`}
          station={editing}
          stationChargers={editing.chargers||[]}
          isLoaded={isLoaded}
          users={users}
          onClose={()=>setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {creating && (
        <StationFormModal
          title="Yeni İstasyon Ekle"
          station={null}
          isLoaded={isLoaded}
          users={users}
          onClose={()=>setCreating(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

//  Reservations Tab 
function ReservationsTab() {
  const [rows,   setRows]   = useState([]);
  const [edit,   setEdit]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');

  const load = () => adminGet('reservations').then(setRows).catch(()=>{});
  useEffect(()=>{ load(); },[]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminUpdateReservation(edit);
      setMsg('Güncellendi  — Kullanıcıya bildirim gönderildi.');
      setEdit(null); load();
    } catch(e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const RES_STATUS_LABELS = { pending:'Beklemede', active:'Aktif', completed:'Tamamlandı', cancelled:'İptal' };
  return (
    <div>
      {msg && <p className="mb-3 text-sm text-blue-400">{msg}</p>}
      <Table
        cols={[
          { key:'id',               label:'ID' },
          { key:'user_name',        label:'Kullanıcı' },
          { key:'station_name',     label:'İstasyon' },
          { key:'reservation_date', label:'Tarih' },
          { key:'start_time',       label:'Başlangıç' },
          { key:'end_time',         label:'Bitiş' },
          { key:'plate',            label:'Plaka' },
          { key:'estimated_cost',   label:'Tutar', render:v=>`${parseFloat(v).toFixed(2)} TL` },
          { key:'status',           label:'Durum', render:v=><Badge v={v}/> },
          { key:'id', label:'Güncelle', render:(_,row)=>(
            <button onClick={()=>setEdit({id:row.id,status:row.status})}
              className="text-xs text-blue-400 hover:underline">Durum Güncelle</button>
          )},
        ]}
        rows={rows}
      />
      {edit && (
        <Modal title="Rezervasyon Durumu Güncelle" onClose={()=>setEdit(null)}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Rezervasyon #{edit.id}</p>
            <select value={edit.status} onChange={e=>setEdit(ed=>({...ed,status:e.target.value}))}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm">
              {['pending','active','completed','cancelled'].map(s=><option key={s} value={s}>{RES_STATUS_LABELS[s]}</option>)}
            </select>
            <p className="text-xs text-gray-400"> Güncelleme sonrası sahibine bildirim gönderilir.</p>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold">
                {saving?'Kaydediliyor…':'Kaydet & Bildir'}
              </button>
              <button onClick={()=>setEdit(null)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-white py-2 rounded-lg text-sm">İptal</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

//  Receipt Modal 
function ReceiptModal({ receipt, onClose }) {
  const printRef = useRef(null);
  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('','_blank','width=480,height=640');
    win.document.write(`<html><head><title>Makbuz</title><style>body{font-family:monospace;padding:24px;color:#111;}h2{text-align:center;margin-bottom:16px;}table{width:100%;border-collapse:collapse;}td{padding:5px 10px;}td:first-child{color:#555;}td:last-child{text-align:right;font-weight:bold;}.total td{font-size:1.15em;border-top:2px solid #333;}</style></head><body>${content}</body></html>`);
    win.document.close(); win.focus(); win.print(); win.close();
  };
  let r={};
  try { r=typeof receipt==='string'?JSON.parse(receipt):receipt; } catch {}
  const LABELS={session_id:'Oturum ID',user:'Kullanıcı',station:'İstasyon',charger:'Şarjcı',vehicle:'Araç',plate:'Plaka',start_time:'Başlangıç',end_time:'Bitiş',duration_min:'Süre (dk)',kwh_consumed:'Tüketim (kWh)',price_per_kwh:'Birim Fiyat',total_cost:'Toplam',generated_at:'Oluşturulma'};
  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900"> Makbuz</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none"></button>
        </div>
        <div className="p-5">
          <div ref={printRef} className="space-y-1">
            <h2 className="text-center text-gray-900 font-bold text-base mb-3">EV Şarj Makbuzu</h2>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(r).map(([key,val])=>{
                  if(!LABELS[key]) return null;
                  let display=val??'—';
                  if(key==='total_cost') display=`${parseFloat(val).toFixed(2)} TL`;
                  if(key==='kwh_consumed') display=`${parseFloat(val).toFixed(2)} kWh`;
                  return(<tr key={key} className="border-b border-gray-200/50">
                    <td className="py-1.5 pr-3 text-gray-500 text-xs">{LABELS[key]}</td>
                    <td className="py-1.5 text-right text-white text-xs font-medium">{display}</td>
                  </tr>);
                })}
              </tbody>
            </table>
            {r.total_cost!==undefined&&(
              <div className="border-t-2 border-blue-600 pt-2 mt-2 flex justify-between">
                <span className="text-blue-400 font-bold text-sm">TOPLAM</span>
                <span className="text-blue-400 font-bold text-lg">{parseFloat(r.total_cost).toFixed(2)} TL</span>
              </div>
            )}
          </div>
          <button onClick={handlePrint}
            className="mt-5 w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
             Yazdır
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

//  Sessions Tab 
function SessionsTab() {
  const [rows,    setRows]    = useState([]);
  const [receipt, setReceipt] = useState(null);
  useEffect(()=>{ adminGet('sessions').then(setRows).catch(()=>{}); },[]);

  const handleExport = () => {
    const cols=[{key:'id',label:'ID'},{key:'user_name',label:'Kullanici'},{key:'station_name',label:'Istasyon'},{key:'plate',label:'Plaka'},{key:'start_time',label:'Baslangic'},{key:'end_time',label:'Bitis'},{key:'kwh_consumed',label:'kWh'},{key:'total_cost',label:'Tutar_TL'},{key:'status',label:'Durum'}];
    const esc=v=>{ if(v==null)return''; const s=String(v).replace(/"/g,'""'); return(s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s}"`:s; };
    const blob=new Blob([''+[cols.map(c=>c.label).join(','),...rows.map(r=>cols.map(c=>esc(r[c.key])).join(','))].join('\r\n')],{type:'text/csv;charset=utf-8;'});
    const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`oturumlar_${new Date().toISOString().slice(0,10)}.csv`});
    a.click();
  };

  return (
    <div>
      {receipt && <ReceiptModal receipt={receipt} onClose={()=>setReceipt(null)}/>}
      <div className="flex justify-end mb-3">
        <button onClick={handleExport}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
           Excel (CSV) İndir
        </button>
      </div>
      <Table
        cols={[
          { key:'id',           label:'ID' },
          { key:'user_name',    label:'Kullanıcı' },
          { key:'station_name', label:'İstasyon' },
          { key:'plate',        label:'Plaka' },
          { key:'start_time',   label:'Başlangıç', render:v=>v?new Date(v).toLocaleString('tr-TR'):'—' },
          { key:'end_time',     label:'Bitiş',     render:v=>v?new Date(v).toLocaleString('tr-TR'):'—' },
          { key:'kwh_consumed', label:'kWh',        render:v=>v?parseFloat(v).toFixed(2):'—' },
          { key:'total_cost',   label:'Tutar',      render:v=>v?`${parseFloat(v).toFixed(2)} TL`:'—' },
          { key:'status',       label:'Durum',      render:v=><Badge v={v}/> },
          { key:'receipt_data', label:'Makbuz',     render:v=>v?(<button className="text-xs text-blue-400 hover:underline" onClick={()=>setReceipt(v)}> Görüntüle</button>):'—' },
        ]}
        rows={rows}
      />
    </div>
  );
}

// Kullanım yüzdesi için renk
function UsageBar({ pct }) {
  const clamped = Math.min(pct, 100);
  const color = clamped >= 75 ? 'bg-red-500' : clamped >= 40 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="text-xs text-gray-700 w-10 text-right">{clamped}%</span>
    </div>
  );
}

//  Revenue Tab 
function RevenueTab() {
  const [data,  setData]  = useState(null);
  const [usage, setUsage] = useState([]);

  useEffect(() => {
    adminGet('revenue').then(setData).catch(() => {});
    getStationUsage().then(setUsage).catch(() => {});
  }, []);

  if (!data) return <p className="text-gray-500 py-8 text-center text-sm">Yükleniyor...</p>;

  return (
    <div className="space-y-8">
      {/* Gelir özeti */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-4">
          <p className="text-blue-300 text-sm">Toplam Gelir</p>
          <p className="text-2xl font-bold text-gray-900">{parseFloat(data.total).toFixed(2)} TL</p>
        </div>
      </div>

      <div>
        <h4 className="text-gray-900 font-semibold mb-3">Aylık Gelir</h4>
        <Table cols={[{key:'month',label:'Ay'},{key:'sessions',label:'Oturum'},{key:'revenue',label:'Gelir',render:v=>`${parseFloat(v).toFixed(2)} TL`}]} rows={data.monthly}/>
      </div>

      <div>
        <h4 className="text-gray-900 font-semibold mb-3">İstasyona Göre Gelir</h4>
        <Table cols={[{key:'name',label:'İstasyon'},{key:'sessions',label:'Oturum'},{key:'revenue',label:'Gelir',render:v=>`${parseFloat(v).toFixed(2)} TL`}]} rows={data.byStation}/>
      </div>

      {/* İstasyon Kullanım Raporu */}
      <div>
        <h4 className="text-gray-900 font-semibold mb-1">İstasyon Kullanım Raporu <span className="text-xs text-gray-500 font-normal">(son 30 gün)</span></h4>
        <p className="text-xs text-gray-400 mb-3">Kullanım % = rezervasyon sayısı ÷ (aktif gün × şarjcı × 14 çalışma saati)</p>
        {usage.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">Henüz veri yok</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">İstasyon</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Şarjcı</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">Rezervasyon</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium w-48">Günlük Kullanım %</th>
                  <th className="text-left px-4 py-2 text-gray-500 font-medium">En Yoğun Saat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usage.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-800 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-gray-500">{s.charger_count}</td>
                    <td className="px-4 py-3 text-gray-500">{s.total_reservations}</td>
                    <td className="px-4 py-3"><UsageBar pct={s.usage_pct} /></td>
                    <td className="px-4 py-3">
                      {s.peak_hour_range === 'Veri yok'
                        ? <span className="text-gray-400 text-xs">Veri yok</span>
                        : <span className="bg-blue-900/40 border border-blue-700 text-blue-300 text-xs px-2 py-0.5 rounded-full"> {s.peak_hour_range}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

//  Vehicles Tab 
function VehiclesTab() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  useEffect(() => { adminGet('vehicles').then(setRows).catch(() => {}); }, []);

  const filtered = rows.filter(r =>
    !search ||
    r.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.plate?.toLowerCase().includes(search.toLowerCase()) ||
    r.brand?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-3">
        <input
          type="text"
          placeholder="Ad, plaka veya marka ara…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-72 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <Table
        cols={[
          { key: 'id',             label: 'ID' },
          { key: 'owner_name',     label: 'Sahip' },
          { key: 'owner_email',    label: 'E-posta' },
          { key: 'brand',          label: 'Marka' },
          { key: 'model',          label: 'Model' },
          { key: 'plate',          label: 'Plaka' },
          { key: 'battery_kwh',    label: 'Batarya', render: v => `${v} kWh` },
          { key: 'connector_type', label: 'Konektör' },
          { key: 'created_at',     label: 'Kayıt',   render: v => new Date(v).toLocaleDateString('tr-TR') },
        ]}
        rows={filtered}
      />
    </div>
  );
}

//  Issues Tab 
const ISSUE_STATUS_LABELS = { open: ' Açık', in_progress: ' İnceleniyor', resolved: ' Çözüldü' };

function IssuesTab() {
  const [rows,         setRows]         = useState([]);
  const [technicians,  setTechnicians]  = useState([]);
  const [edit,         setEdit]         = useState(null);  // { id, status }
  const [techModal,    setTechModal]    = useState(null);  // { id, issueTitle, stationName } — teknisyen seçim modalı
  const [selectedTech, setSelectedTech] = useState('');
  const [maintStart,   setMaintStart]   = useState('');
  const [maintEnd,     setMaintEnd]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');
  const [detail,       setDetail]       = useState(null);
  const [search,       setSearch]       = useState('');

  const load = () => getMyIssues().then(setRows).catch(() => {});
  useEffect(() => {
    load();
    getTechnicians().then(setTechnicians).catch(() => {});
  }, []);

  const filtered = rows.filter(r =>
    !search ||
    r.station_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.title?.toLowerCase().includes(search.toLowerCase()) ||
    r.reporter_name?.toLowerCase().includes(search.toLowerCase())
  );

  const openCount       = rows.filter(r => r.status === 'open').length;
  const inProgressCount = rows.filter(r => r.status === 'in_progress').length;

  const handleSave = async () => {
    // in_progress → teknisyen seçim modalı
    if (edit.status === 'in_progress') {
      const row = rows.find(r => r.id === edit.id);
      // Varsayılan bakım penceresi: şu an → +24 saat (datetime-local formatı)
      const now  = new Date(); now.setSeconds(0, 0);
      const end  = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const fmt  = d => d.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
      setMaintStart(fmt(now));
      setMaintEnd(fmt(end));
      setTechModal({ id: edit.id, issueTitle: row?.title, stationName: row?.station_name, chargerCode: row?.charger_code });
      setSelectedTech('');
      setEdit(null);
      return;
    }
    setSaving(true);
    try {
      await patchIssue(edit.id, edit.status);
      setMsg('Durum güncellendi ');
      setEdit(null);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  const handleAssignTechnician = async () => {
    if (!selectedTech) return;
    setSaving(true);
    try {
      const res = await patchIssue(techModal.id, 'in_progress', parseInt(selectedTech), maintStart, maintEnd);
      const cancelledText = res.cancelled_count > 0 ? ` ${res.cancelled_count} rezervasyon iptal edildi, iadeler yapıldı.` : '';
      setMsg(techModal.chargerCode
        ? `Teknisyen atandı, ${techModal.chargerCode} şarjcısı offline alındı ${cancelledText}`
        : `Teknisyen atandı, istasyon bakıma alındı ${cancelledText}`);
      setTechModal(null);
      setSelectedTech('');
      load();
    } catch (e) { setMsg(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-300">{openCount}</p>
          <p className="text-xs text-red-400">Açık</p>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-yellow-300">{inProgressCount}</p>
          <p className="text-xs text-yellow-400">İnceleniyor</p>
        </div>
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-blue-300">{rows.filter(r => r.status === 'resolved').length}</p>
          <p className="text-xs text-blue-400">Çözüldü</p>
        </div>
      </div>

      {msg && <p className="text-sm text-blue-400">{msg}</p>}

      <input
        type="text"
        placeholder="İstasyon, başlık veya kullanıcı ara…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full sm:w-80 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <Table
        cols={[
          { key: 'id',            label: 'ID' },
          { key: 'station_name',  label: 'İstasyon' },
          { key: 'charger_code',  label: 'Şarjcı',    render: v => v || '—' },
          { key: 'reporter_name', label: 'Bildiren' },
          { key: 'title',         label: 'Başlık' },
          { key: 'status',        label: 'Durum',      render: v => <Badge v={v} /> },
          { key: 'created_at',    label: 'Tarih',      render: v => new Date(v).toLocaleDateString('tr-TR') },
          { key: 'id', label: 'İşlemler', render: (_, row) => (
            <div className="flex gap-2">
              <button onClick={() => setDetail(row)}
                className="text-xs text-blue-400 hover:underline">Detay</button>
              <button onClick={() => setEdit({ id: row.id, status: row.status })}
                className="text-xs text-blue-400 hover:underline">Güncelle</button>
            </div>
          )},
        ]}
        rows={filtered}
      />

      {/* Durum güncelleme modal */}
      {edit && (
        <Modal title="Sorun Durumunu Güncelle" onClose={() => setEdit(null)}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500">Sorun #{edit.id}</p>
            <select
              value={edit.status}
              onChange={e => setEdit(ed => ({ ...ed, status: e.target.value }))}
              className="w-full bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(ISSUE_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {edit.status === 'in_progress' && (
              <p className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-800 rounded-lg px-3 py-2">
                 Bir sonraki adımda teknisyen seçmeniz gerekecek ve istasyon otomatik olarak bakıma alınacak.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold">
                {saving ? 'Kaydediliyor…' : 'Devam Et →'}
              </button>
              <button onClick={() => setEdit(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-white py-2 rounded-lg text-sm">İptal</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Teknisyen seçim modalı */}
      {techModal && (
        <Modal title="Teknisyen Ata & Bakım Planla" onClose={() => setTechModal(null)}>
          <div className="space-y-4">
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-3">
              <p className="text-xs text-yellow-300 font-semibold">{techModal.stationName}</p>
              {techModal.chargerCode && (
                <p className="text-xs text-orange-300 mt-0.5"> Şarjcı: {techModal.chargerCode}</p>
              )}
              <p className="text-xs text-gray-700 mt-0.5">{techModal.issueTitle}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500">Teknisyen Seç *</label>
              <select
                value={selectedTech}
                onChange={e => setSelectedTech(e.target.value)}
                className="w-full mt-1 bg-white border border-gray-300 text-gray-900 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Teknisyen seçin —</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                ))}
              </select>
            </div>
            <div className="bg-gray-50 border border-gray-300 rounded-xl p-3 space-y-3">
              <p className="text-xs text-gray-700 font-medium"> Bakım Zaman Aralığı</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500">Başlangıç</label>
                  <input
                    type="datetime-local"
                    value={maintStart}
                    onChange={e => setMaintStart(e.target.value)}
                    className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">Tahmini Bitiş</label>
                  <input
                    type="datetime-local"
                    value={maintEnd}
                    onChange={e => setMaintEnd(e.target.value)}
                    className="w-full mt-0.5 bg-white border border-gray-300 text-gray-900 rounded-lg px-2 py-1.5 text-xs"
                  />
                </div>
              </div>
              <p className="text-[10px] text-amber-400">
                 Bu aralıktaki tüm rezervasyonlar iptal edilecek ve kullanıcılara otomatik iade + bildirim gönderilecek.
              </p>
            </div>
            <p className="text-xs text-gray-400">
              {techModal.chargerCode
                ? <> Seçilen teknisyene bildirim gönderilecek ve <span className="text-orange-400">{techModal.chargerCode}</span> şarjcısı offline alınacak.</>
                : <> Seçilen teknisyene bildirim gönderilecek ve istasyon <span className="text-yellow-400">Bakımda</span> durumuna alınacak.</>
              }
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAssignTechnician}
                disabled={saving || !selectedTech || !maintStart || !maintEnd}
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold"
              >
                {saving ? 'Atanıyor…' : techModal.chargerCode ? ' Teknisyen Ata & Offline Al' : ' Teknisyen Ata & Bakıma Al'}
              </button>
              <button onClick={() => setTechModal(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-white py-2 rounded-lg text-sm">İptal</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Detay modal */}
      {detail && (
        <Modal title="Sorun Detayı" onClose={() => setDetail(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-start">
              <p className="font-semibold text-gray-900 text-base">{detail.title}</p>
              <Badge v={detail.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><p className="text-gray-400">İstasyon</p><p className="text-gray-800">{detail.station_name}</p></div>
              <div><p className="text-gray-400">Şarjcı</p><p className="text-gray-800">{detail.charger_code || '—'}</p></div>
              <div><p className="text-gray-400">Bildiren</p><p className="text-gray-800">{detail.reporter_name || '—'}</p></div>
              <div><p className="text-gray-400">Tarih</p><p className="text-gray-800">{new Date(detail.created_at).toLocaleString('tr-TR')}</p></div>
            </div>
            <div className="bg-gray-50 border border-gray-300 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Açıklama</p>
              <p className="text-gray-800 text-sm whitespace-pre-wrap">{detail.description}</p>
            </div>
            <button
              onClick={() => { setEdit({ id: detail.id, status: detail.status }); setDetail(null); }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold"
            > Durumu Güncelle</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

//  Main 
export default function AdminDashboard({ isLoaded, tab = 'users' }) {
  const VIEWS = {
    users:        () => <UsersTab />,
    stations:     () => <StationsTab isLoaded={isLoaded} />,
    reservations: () => <ReservationsTab />,
    sessions:     () => <SessionsTab />,
    revenue:      () => <RevenueTab />,
    vehicles:     () => <VehiclesTab />,
    issues:       () => <IssuesTab />,
  };
  const View = VIEWS[tab] || VIEWS.users;
  const meta = PAGE_META[tab] || PAGE_META.users;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Sayfa başlığı */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-2xl shrink-0">
          {meta.icon}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 leading-tight">{meta.label}</h2>
          <p className="text-gray-500 text-sm mt-0.5">{meta.desc}</p>
        </div>
      </div>

      {/* İçerik kartı */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6">
          <View />
        </div>
      </div>
    </div>
  );
}
