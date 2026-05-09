export const STATIONS = [
  {
    id: 1,
    name: 'Karşıyaka Hub',
    address: 'Karşıyaka, İzmir',
    lat: 38.4589,
    lng: 27.1089,
    distance: 2.3,
    hours: '00:00–24:00',
    rating: 4.5,
    chargers: [
      { id: 'KH-01', type: 'AC',  power: 22,  connector: 'Type 2',  status: 'available', price: 3.5 },
      { id: 'KH-02', type: 'DC',  power: 50,  connector: 'CCS',     status: 'occupied',  price: 4.0 },
      { id: 'KH-03', type: 'DC',  power: 50,  connector: 'CCS',     status: 'available', price: 4.0 },
      { id: 'KH-04', type: 'DC',  power: 150, connector: 'CHAdeMO', status: 'offline',   price: 5.0 },
    ],
  },
  {
    id: 2,
    name: 'Bornova Station',
    address: 'Bornova, İzmir',
    lat: 38.4672,
    lng: 27.2134,
    distance: 4.1,
    hours: '06:00–23:00',
    rating: 4.2,
    chargers: [
      { id: 'BN-01', type: 'AC', power: 22, connector: 'Type 2', status: 'available', price: 3.2 },
      { id: 'BN-02', type: 'DC', power: 50, connector: 'CCS',    status: 'available', price: 3.8 },
    ],
  },
  {
    id: 3,
    name: 'Buca Point',
    address: 'Buca, İzmir',
    lat: 38.3834,
    lng: 27.1896,
    distance: 6.8,
    hours: '08:00–22:00',
    rating: 3.9,
    chargers: [
      { id: 'BP-01', type: 'DC', power: 150, connector: 'CCS',     status: 'offline',   price: 5.5 },
      { id: 'BP-02', type: 'DC', power: 150, connector: 'CHAdeMO', status: 'available', price: 5.5 },
    ],
  },
  {
    id: 4,
    name: 'Alsancak Point',
    address: 'Alsancak, İzmir',
    lat: 38.4376,
    lng: 27.1449,
    distance: 0.8,
    hours: '00:00–24:00',
    rating: 4.7,
    chargers: [
      { id: 'AL-01', type: 'AC', power: 22, connector: 'Type 2', status: 'occupied',  price: 3.0 },
      { id: 'AL-02', type: 'DC', power: 50, connector: 'CCS',    status: 'available', price: 4.2 },
    ],
  },
  {
    id: 5,
    name: 'Konak Plaza',
    address: 'Konak, İzmir',
    lat: 38.4192,
    lng: 27.1287,
    distance: 1.5,
    hours: '09:00–22:00',
    rating: 4.3,
    chargers: [
      { id: 'KP-01', type: 'DC', power: 50, connector: 'CCS',    status: 'available', price: 4.5 },
      { id: 'KP-02', type: 'DC', power: 50, connector: 'CCS',    status: 'available', price: 4.5 },
      { id: 'KP-03', type: 'AC', power: 22, connector: 'Type 2', status: 'occupied',  price: 3.5 },
    ],
  },
  {
    id: 6,
    name: 'Mavişehir Charge',
    address: 'Mavişehir, İzmir',
    lat: 38.4712,
    lng: 27.0823,
    distance: 3.2,
    hours: '00:00–24:00',
    rating: 4.1,
    chargers: [
      { id: 'MV-01', type: 'DC', power: 150, connector: 'CCS',     status: 'available', price: 5.2 },
      { id: 'MV-02', type: 'DC', power: 50,  connector: 'CHAdeMO', status: 'available', price: 4.0 },
    ],
  },
]

export const BRANDS = [
  'Tesla', 'BMW', 'Audi', 'Volkswagen', 'Hyundai', 'Kia',
  'Mercedes-Benz', 'Volvo', 'Nissan', 'Porsche', 'Rivian', 'Lucid', 'Togg',
]

export const CONNECTORS = ['CCS', 'CHAdeMO', 'Type 2']

/** Simulated occupied slots per charger id */
export const OCCUPIED_SLOTS = {
  'KH-02': ['10:00', '11:00', '14:00', '15:00'],
  'AL-01': ['09:00', '13:00', '17:00'],
  'KP-03': ['11:00', '15:00', '16:00'],
}

/** User's simulated current location (Alsancak, İzmir) */
export const USER_LOCATION = { lat: 38.4376, lng: 27.1449 }

export const MAP_CENTER = { lat: 38.435, lng: 27.15 }
