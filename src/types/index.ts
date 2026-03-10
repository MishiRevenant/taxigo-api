// Shared TypeScript types for the backend
export type UserRole = 'passenger' | 'driver'
export type TripStatus = 'requested' | 'accepted' | 'on_ride' | 'completed' | 'cancelled'
export type VehicleType = 'standard' | 'comfort' | 'xl'

export interface User {
    id: string
    name: string
    email: string
    role: UserRole
    phone?: string
    rating: number
    createdAt: string
}

export interface Trip {
    id: string
    passengerId: string
    driverId?: string
    passenger?: User
    driver?: User
    originAddress: string
    originLat: number
    originLng: number
    destinationAddress: string
    destinationLat: number
    destinationLng: number
    status: TripStatus
    vehicleType: VehicleType
    notes?: string
    fare?: number
    distance?: number
    duration?: number
    requestedAt: string
    acceptedAt?: string
    startedAt?: string
    completedAt?: string
}

export interface AuthTokens {
    accessToken: string
    refreshToken: string
}

// Extend Express Request
declare module 'express' {
    interface Request {
        user?: User
    }
}
