import 'reflect-metadata'
import 'dotenv/config'
import { AppDataSource } from '../config/database'
import { User } from '../entities/User'
import { Trip } from '../entities/Trip'
import bcrypt from 'bcryptjs'

async function seed() {
    try {
        await AppDataSource.initialize()
        console.log('✅ Connected to database')

        const userRepo = AppDataSource.getRepository(User)
        const tripRepo = AppDataSource.getRepository(Trip)

        const users = [
            {
                id: 'user-passenger-1',
                name: 'Carlos Méndez',
                email: 'passenger@taxigo.com',
                password: await bcrypt.hash('password', 10),
                role: 'passenger' as const,
                phone: '+57 300 123 4567',
                rating: 4.8,
            },
            {
                id: 'user-driver-1',
                name: 'Luis Rodríguez',
                email: 'driver@taxigo.com',
                password: await bcrypt.hash('password', 10),
                role: 'driver' as const,
                phone: '+57 311 987 6543',
                rating: 4.9,
            },
        ]

        for (const userData of users) {
            const existing = await userRepo.findOne({ where: { email: userData.email } })
            if (existing) {
                await userRepo
                    .createQueryBuilder()
                    .update(User)
                    .set({ name: userData.name, phone: userData.phone, rating: userData.rating })
                    .where('email = :email', { email: userData.email })
                    .execute()
                console.log(`  ↺ Updated: ${userData.email}`)
            } else {
                await userRepo.save(userRepo.create(userData))
                console.log(`  ✓ Created: ${userData.email}`)
            }
        }

        // Ensure passenger and driver exist for seed trips
        const passengerExists = await userRepo.findOne({ where: { id: 'user-passenger-1' } })
        const driverExists = await userRepo.findOne({ where: { id: 'user-driver-1' } })

        if (passengerExists && driverExists) {
            const seedTrips = [
                {
                    id: 'trip-history-1',
                    passengerId: 'user-passenger-1',
                    driverId: 'user-driver-1',
                    originAddress: 'Calle 100 #15-10, Bogotá',
                    originLat: 4.6097, originLng: -74.0817,
                    destinationAddress: 'El Dorado, Bogotá',
                    destinationLat: 4.6558, destinationLng: -74.0553,
                    status: 'completed' as const,
                    vehicleType: 'standard' as const,
                    fare: 25000, distance: 12.5, duration: 35,
                    requestedAt: new Date('2025-03-01T14:00:00Z'),
                    acceptedAt: new Date('2025-03-01T14:02:00Z'),
                    startedAt: new Date('2025-03-01T14:08:00Z'),
                    completedAt: new Date('2025-03-01T14:43:00Z'),
                },
                {
                    id: 'trip-history-2',
                    passengerId: 'user-passenger-1',
                    driverId: 'user-driver-1',
                    originAddress: 'Carrera 7 #32-16, Bogotá',
                    originLat: 4.6097, originLng: -74.0817,
                    destinationAddress: 'Zona Rosa, Bogotá',
                    destinationLat: 4.6487, destinationLng: -74.0779,
                    status: 'completed' as const,
                    vehicleType: 'comfort' as const,
                    fare: 18000, distance: 8.2, duration: 22,
                    requestedAt: new Date('2025-02-28T09:00:00Z'),
                    acceptedAt: new Date('2025-02-28T09:03:00Z'),
                    startedAt: new Date('2025-02-28T09:10:00Z'),
                    completedAt: new Date('2025-02-28T09:32:00Z'),
                },
            ]

            for (const tripData of seedTrips) {
                const existing = await tripRepo.findOne({ where: { id: tripData.id } })
                if (!existing) {
                    await tripRepo.save(tripRepo.create(tripData))
                    console.log(`  ✓ Seeded trip: ${tripData.id}`)
                } else {
                    console.log(`  ↺ Trip already exists: ${tripData.id}`)
                }
            }
        }

        console.log('\n✅ Seed completo!')
        console.log('   passenger@taxigo.com / password')
        console.log('   driver@taxigo.com / password')
    } catch (err) {
        console.error('Seed failed:', err)
        process.exit(1)
    } finally {
        await AppDataSource.destroy()
        process.exit(0)
    }
}

seed()
