import { Injectable } from '@nestjs/common'
import { MongoConnection } from '../mongodb/mongo-connection.js'

@Injectable()
export class MongoHealthIndicator {
    async isHealthy(key: string, connection: MongoConnection) {
        try {
            await connection.ping()
            return { [key]: { status: 'up' as const } }
        } catch (error: unknown) {
            return { [key]: { reason: String(error), status: 'down' as const } }
        }
    }
}
