import type { User } from '../entities/User'
import type { Trip } from '../entities/Trip'

export type { User, Trip }
export type { UserRole } from '../entities/User'
export type { TripStatus, VehicleType } from '../entities/Trip'
export type { AuthTokens } from '../services/jwt'

// Extend Express Request
declare global {
    namespace Express {
        interface Request {
            user?: User
        }
    }
}

