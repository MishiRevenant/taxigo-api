import 'reflect-metadata'
import {
    Entity, PrimaryColumn, Column,
    ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm'
import { User } from './User'

export type TripStatus = 'requested' | 'accepted' | 'on_ride' | 'completed' | 'cancelled'
export type VehicleType = 'standard' | 'comfort' | 'xl'

@Entity('trips')
export class Trip {
    @PrimaryColumn('varchar', { length: 255 })
    id: string

    @Column({ name: 'passenger_id', length: 255 })
    passengerId: string

    @Column({ name: 'driver_id', length: 255, nullable: true })
    driverId: string | null

    @ManyToOne(() => User, (user) => user.passengerTrips, { eager: false })
    @JoinColumn({ name: 'passenger_id' })
    passenger: User

    @ManyToOne(() => User, (user) => user.driverTrips, { eager: false, nullable: true })
    @JoinColumn({ name: 'driver_id' })
    driver: User | null

    @Column({ name: 'origin_address', type: 'text' })
    originAddress: string

    @Column({ name: 'origin_lat', type: 'numeric' })
    originLat: number

    @Column({ name: 'origin_lng', type: 'numeric' })
    originLng: number

    @Column({ name: 'destination_address', type: 'text' })
    destinationAddress: string

    @Column({ name: 'destination_lat', type: 'numeric' })
    destinationLat: number

    @Column({ name: 'destination_lng', type: 'numeric' })
    destinationLng: number

    @Column({
        type: 'varchar',
        length: 50,
        default: 'requested',
        enum: ['requested', 'accepted', 'on_ride', 'completed', 'cancelled'],
    })
    status: TripStatus

    @Column({
        name: 'vehicle_type',
        type: 'varchar',
        length: 50,
        default: 'standard',
        enum: ['standard', 'comfort', 'xl'],
    })
    vehicleType: VehicleType

    @Column({ type: 'text', nullable: true })
    notes: string | null

    @Column({ type: 'numeric', nullable: true })
    fare: number | null

    @Column({ type: 'numeric', nullable: true })
    distance: number | null

    @Column({ type: 'integer', nullable: true })
    duration: number | null

    @CreateDateColumn({ name: 'requested_at' })
    requestedAt: Date

    @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
    acceptedAt: Date | null

    @Column({ name: 'started_at', type: 'timestamp', nullable: true })
    startedAt: Date | null

    @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
    completedAt: Date | null
}
