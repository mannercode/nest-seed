import type { OnModuleDestroy } from '@nestjs/common'
import type { Db, MongoClient } from 'mongodb'

export class MongoConnection implements OnModuleDestroy {
    constructor(
        public readonly client: MongoClient,
        public readonly db: Db,
        private readonly ownsClient = true
    ) {}

    async onModuleDestroy() {
        if (this.ownsClient) await this.client.close()
    }
}

export const REDIS_CONNECTION_NAME = 'redis-connection'
export const NATS_CONNECTION_NAME = 'nats-connection'
