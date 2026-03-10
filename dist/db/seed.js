import 'dotenv/config';
import { db, initDb } from '../db/init.js';
import bcrypt from 'bcryptjs';
async function seed() {
    await initDb();
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
    ];
    for (const user of users) {
        await db.query(`
            INSERT INTO users (id, name, email, password, role, phone, rating, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (email) DO UPDATE SET
                name = EXCLUDED.name,
                password = EXCLUDED.password,
                phone = EXCLUDED.phone,
                rating = EXCLUDED.rating
        `, [user.id, user.name, user.email, user.password, user.role, user.phone, user.rating, user.created_at]);
    }
    // Add some history trips
    const trips = [
        {
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
        },
        {
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
        }
    ];
    for (const trip of trips) {
        await db.query(`
            INSERT INTO trips (
                id, passenger_id, driver_id,
                origin_address, origin_lat, origin_lng,
                destination_address, destination_lat, destination_lng,
                status, vehicle_type, fare, distance, duration,
                requested_at, accepted_at, started_at, completed_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            )
            ON CONFLICT (id) DO NOTHING
        `, [
            trip.id, trip.passenger_id, trip.driver_id,
            trip.origin_address, trip.origin_lat, trip.origin_lng,
            trip.destination_address, trip.destination_lat, trip.destination_lng,
            trip.status, trip.vehicle_type, trip.fare, trip.distance, trip.duration,
            trip.requested_at, trip.accepted_at, trip.started_at, trip.completed_at
        ]);
    }
    console.log('✅ Seeded: passenger@taxigo.com + driver@taxigo.com (password: password)');
    // Process exits after seeding
    process.exit(0);
}
seed().catch(err => {
    console.error('Seed failed', err);
    process.exit(1);
});
