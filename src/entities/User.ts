import 'reflect-metadata'
import {
    Entity, PrimaryColumn, Column, CreateDateColumn,
    OneToMany,
} from 'typeorm'
import { Trip } from './Trip'
import { RefreshToken } from './RefreshToken'

export type UserRole = 'passenger' | 'driver'

@Entity('users')
export class User {
    @PrimaryColumn('varchar', { length: 255 })
    id: string

    @Column({ length: 255 })
    name: string

    @Column({ unique: true, length: 255 })
    email: string

    @Column({ length: 255, select: false })
    password: string

    @Column({ type: 'varchar', length: 50 })
    role: UserRole

    @Column({ type: 'varchar', length: 255, nullable: true })
    phone: string | null

    @Column({ type: 'numeric', default: 5.0 })
    rating: number

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date

    @OneToMany(() => Trip, (trip) => trip.passenger)
    passengerTrips: Trip[]

    @OneToMany(() => Trip, (trip) => trip.driver)
    driverTrips: Trip[]

    @OneToMany(() => RefreshToken, (rt) => rt.user)
    refreshTokens: RefreshToken[]
}
