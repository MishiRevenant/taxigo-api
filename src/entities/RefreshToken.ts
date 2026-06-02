import 'reflect-metadata'
import {
    Entity, PrimaryColumn, Column,
    ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm'
import { User } from './User'

@Entity('refresh_tokens')
export class RefreshToken {
    @PrimaryColumn('varchar', { length: 255 })
    id: string

    @Column({ name: 'user_id', length: 255 })
    userId: string

    @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User

    @Column({ type: 'text', unique: true })
    token: string

    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt: Date

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date
}
