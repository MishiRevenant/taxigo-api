import 'dotenv/config'
import { db, initDb } from '../db/init.js'
import bcrypt from 'bcryptjs'

// Seed with demo users
initDb()

const users = [
    {
        id: 'user-passenger-1',
        name: 'Carlos Méndez',
        email: 'passenger@taxigo.com',
        password: await bcrypt.hash('password', 10),
        role: 'passenger',
        phone: '+57 300 123 4567',
        rating: 4.8,
        created_at: '2024-01-15T10:00:00Z',
    },
    {
        id: 'user-driver-1',
        name: 'Luis Rodríguez',
        email: 'driver@taxigo.com',
        password: await bcrypt.hash('password', 10),
        role: 'driver',
        phone: '+57 311 987 6543',
        rating: 4.9,
        created_at: '2024-01-10T08:00:00Z',
    },
]

const upsert = db.prepare(`
  INSERT INTO users (id, name, email, password, role, phone, rating, created_at)
  VALUES (@id, @name, @email, @password, @role, @phone, @rating, @created_at)
  ON CONFLICT(email) DO UPDATE SET
    name = excluded.name,
    password = excluded.password,
    phone = excluded.phone,
    rating = excluded.rating
`)

for (const user of users) {
    upsert.run(user)
}

// Add some history trips
const tripInsert = db.prepare(`
  INSERT OR IGNORE INTO trips (
    id, passenger_id, driver_id,
    origin_address, origin_lat, origin_lng,
    destination_address, destination_lat, destination_lng,
    status, vehicle_type, fare, distance, duration,
    requested_at, accepted_at, started_at, completed_at
  ) VALUES (
    @id, @passenger_id, @driver_id,
    @origin_address, @origin_lat, @origin_lng,
    @destination_address, @destination_lat, @destination_lng,
    @status, @vehicle_type, @fare, @distance, @duration,
    @requested_at, @accepted_at, @started_at, @completed_at
  )
`)

tripInsert.run({
    id: 'trip-history-1',
    passenger_id: 'user-passenger-1',
    driver_id: 'user-driver-1',
    origin_address: 'Calle 100 #15-10, Bogotá',
    origin_lat: 4.6097, origin_lng: -74.0817,
    destination_address: 'El Dorado, Bogotá',
    destination_lat: 4.6558, destination_lng: -74.0553,
    status: 'completed',
    vehicle_type: 'standard',
    fare: 25000, distance: 12.5, duration: 35,
    requested_at: '2025-03-01T14:00:00Z',
    accepted_at: '2025-03-01T14:02:00Z',
    started_at: '2025-03-01T14:08:00Z',
    completed_at: '2025-03-01T14:43:00Z',
})

tripInsert.run({
    id: 'trip-history-2',
    passenger_id: 'user-passenger-1',
    driver_id: 'user-driver-1',
    origin_address: 'Carrera 7 #32-16, Bogotá',
    origin_lat: 4.6097, origin_lng: -74.0817,
    destination_address: 'Zona Rosa, Bogotá',
    destination_lat: 4.6487, destination_lng: -74.0779,
    status: 'completed',
    vehicle_type: 'comfort',
    fare: 18000, distance: 8.2, duration: 22,
    requested_at: '2025-02-28T09:00:00Z',
    accepted_at: '2025-02-28T09:03:00Z',
    started_at: '2025-02-28T09:10:00Z',
    completed_at: '2025-02-28T09:32:00Z',
})

console.log('✅ Seeded: passenger@taxigo.com + driver@taxigo.com (password: password)')
