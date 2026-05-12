const BASE = import.meta.env.VITE_API_URL || '/api';

// ── Token helpers ─────────────────────────────────────────────
export const getToken  = ()        => localStorage.getItem('ev_token');
export const setToken  = (t)       => localStorage.setItem('ev_token', t);
export const clearToken = ()       => localStorage.removeItem('ev_token');

// ── Core fetch wrapper ────────────────────────────────────────
async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res  = await fetch(`${BASE}/${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Auth ──────────────────────────────────────────────────────
export const login = async (email, password) => {
  const data = await request('auth.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', email, password }),
  });
  setToken(data.token);
  return data.user;
};

export const register = async (name, email, password) => {
  const data = await request('auth.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'register', name, email, password }),
  });
  setToken(data.token);
  return data.user;
};

export const logout = () => {
  clearToken();
  return Promise.resolve();
};

export const me = () => request('auth.php?action=me');

// ── Stations ──────────────────────────────────────────────────
export const getStations      = ()           => request('stations.php');
export const getMyTopStation  = ()           => request('stations.php?action=my_top');
export const getMyFavorites   = ()           => request('stations.php?action=my_favorites');
export const addFavorite      = (station_id) => request('stations.php?action=favorite', { method: 'POST', body: JSON.stringify({ station_id }) });
export const removeFavorite   = (station_id) => request(`stations.php?action=favorite&station_id=${station_id}`, { method: 'DELETE' });

export const createStation = (data) =>
  request('stations.php', { method: 'POST', body: JSON.stringify(data) });

export const updateStation = (id, data) =>
  request(`stations.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Chargers ──────────────────────────────────────────────────
export const createCharger = (data) =>
  request('chargers.php', { method: 'POST', body: JSON.stringify(data) });

export const updateCharger = (id, data) =>
  request(`chargers.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteCharger = (id) =>
  request(`chargers.php?id=${id}`, { method: 'DELETE' });

export const patchCharger = (id, status) =>
  request(`chargers.php?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const getCharger = (id) => request(`chargers.php?id=${id}`);

// ── Vehicles ──────────────────────────────────────────────────
export const getVehicles = () => request('vehicles.php');

export const addVehicle = (data) =>
  request('vehicles.php', { method: 'POST', body: JSON.stringify(data) });

export const updateVehicle = (id, data) =>
  request(`vehicles.php?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteVehicle = (id) =>
  request(`vehicles.php?id=${id}`, { method: 'DELETE' });

// ── Wallet ────────────────────────────────────────────────────
export const getWallet = () => request('wallet.php');

export const topUpWallet = (amount, card_number) =>
  request('wallet.php', { method: 'POST', body: JSON.stringify({ amount, card_number }) });

// ── Reservations ──────────────────────────────────────────────
export const getReservations = () => request('reservations.php');

export const createReservation = (data) =>
  request('reservations.php', { method: 'POST', body: JSON.stringify(data) });

export const cancelReservation = (id) =>
  request(`reservations.php?id=${id}`, { method: 'DELETE' });

// ── Charging Sessions ─────────────────────────────────────────
export const getSessions = () => request('charging_sessions.php');

export const startSession = (reservation_id, vehicle_pin) =>
  request('charging_sessions.php', { method: 'POST', body: JSON.stringify({ reservation_id, vehicle_pin }) });

export const endSession = (id, kwh_consumed, overstay_minutes = 0) =>
  request(`charging_sessions.php?id=${id}`, { method: 'PUT', body: JSON.stringify({ kwh_consumed, overstay_minutes }) });

export const markSessionOverstay = (session_id) =>
  request(`charging_sessions.php?action=mark_overstay&id=${session_id}`, { method: 'PATCH' });

export const checkExtension = (session_id) =>
  request(`charging_sessions.php?action=check_extension&session_id=${session_id}`);

export const extendSession = (session_id) =>
  request('charging_sessions.php?action=extend', { method: 'POST', body: JSON.stringify({ session_id }) });

// ── Notifications ─────────────────────────────────────────────
export const getNotifications = () => request('notifications.php');

export const markNotificationRead = (id) =>
  request('notifications.php', { method: 'PUT', body: JSON.stringify({ id }) });

export const markAllNotificationsRead = () =>
  request('notifications.php', { method: 'PUT', body: JSON.stringify({ action: 'mark_all_read' }) });

// ── Admin ─────────────────────────────────────────────────────
export const adminGet = (type) => request(`admin.php?type=${type}`);

export const adminUpdateUser = (data) =>
  request('admin.php', { method: 'PUT', body: JSON.stringify({ ...data, entity: 'user' }) });

export const adminUpdateStation = (data) =>
  request('admin.php', { method: 'PUT', body: JSON.stringify({ ...data, entity: 'station' }) });

export const adminUpdateReservation = (data) =>
  request('admin.php', { method: 'PUT', body: JSON.stringify({ ...data, entity: 'reservation' }) });

export const adminDeleteUser = (id) =>
  request(`admin.php?id=${id}`, { method: 'DELETE' });

export const getStationUsage = () => request('admin.php?type=station_usage');

// ── Station Issues ────────────────────────────────────────────
export const reportIssue    = (data)                          => request('issues.php', { method: 'POST', body: JSON.stringify(data) });
export const getMyIssues    = ()                              => request('issues.php');
export const patchIssue      = (id, status, technicianId=null, maintenanceStart=null, maintenanceEnd=null) => request(`issues.php?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status, ...(technicianId ? { technician_id: technicianId } : {}), ...(maintenanceStart ? { maintenance_start: maintenanceStart } : {}), ...(maintenanceEnd ? { maintenance_end: maintenanceEnd } : {}) }) });
export const cannotFixIssue  = (id)                           => request(`issues.php?id=${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cannot_fix' }) });
export const getTechnicians  = ()                             => request('technicians.php');

// ── Waiting Queue ─────────────────────────────────────────────
export const getMyQueue  = ()                              => request('queue.php');
export const joinQueue   = (station_id, connector_type)   => request('queue.php', { method: 'POST', body: JSON.stringify({ station_id, connector_type }) });
export const leaveQueue  = (station_id)                   => request(`queue.php?station_id=${station_id}`, { method: 'DELETE' });

// ── Demo Time Control (admin only) ───────────────────────────
export const getDemoTime   = ()              => request('demo.php');
export const addDemoTime   = (add_seconds)   => request('demo.php', { method: 'POST', body: JSON.stringify({ add_seconds }) });
export const setDemoOffset = (set_seconds)   => request('demo.php', { method: 'POST', body: JSON.stringify({ set_seconds }) });
export const resetDemoTime = ()              => request('demo.php', { method: 'DELETE' });

// ── Kullanıcı kendi hesabını sil ─────────────────────────────
export const deleteMyAccount = () =>
  request('auth.php?action=delete', { method: 'DELETE' });
