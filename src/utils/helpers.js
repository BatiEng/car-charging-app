export const STATUS_COLOR = {
  available:   '#22c55e',
  occupied:    '#eab308',
  offline:     '#ef4444',
  maintenance: '#f97316',
  inactive:    '#6b7280',
}

export const STATUS_BADGE = {
  available:   'bg-green-100 text-green-700',
  occupied:    'bg-yellow-100 text-yellow-700',
  offline:     'bg-red-100 text-red-700',
  maintenance: 'bg-orange-100 text-orange-700',
  inactive:    'bg-slate-200 text-gray-400',
}

export const getStationStatus = (station) => {
  const statuses = station.chargers.map((c) => c.status)
  if (statuses.includes('available')) return 'available'
  if (statuses.includes('occupied'))  return 'occupied'
  return 'offline'
}

/** SVG data-URL icon for Google Maps Marker.
 *  Must be called after Maps API is loaded (window.google is available). */
export const getMarkerIcon = (color) => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
       <circle cx="14" cy="14" r="11" fill="${color}" stroke="white" stroke-width="3"/>
     </svg>`
  )}`,
  scaledSize: new window.google.maps.Size(28, 28),
  anchor:     new window.google.maps.Point(14, 14),
})

export const getUserMarkerIcon = () => ({
  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
       <circle cx="14" cy="14" r="11" fill="#3b82f6" stroke="white" stroke-width="3"/>
       <circle cx="14" cy="14" r="4"  fill="white"/>
     </svg>`
  )}`,
  scaledSize: new window.google.maps.Size(28, 28),
  anchor:     new window.google.maps.Point(14, 14),
})

export const pad2     = (n) => String(n).padStart(2, '0')
export const fmtTime  = (s) =>
  `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`

export const todayISO    = () => new Date().toISOString().split('T')[0]
export const tomorrowISO = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}
