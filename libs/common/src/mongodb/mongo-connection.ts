import type { OnModuleDestroy } from '@nestjs/common'
import { MongoClient, type Db, type MongoClientOptions } from 'mongodb'

export type MongoConnectionOptions = { uri: string; dbName: string; appName?: string }

export function createMongoDriverOptions({
    appName
}: Pick<MongoConnectionOptions, 'appName'>): MongoClientOptions {
    return {
        appName,
        // 연결은 필요할 때 만들고, 요청 처리의 대기 시간만 제한한다.
        minPoolSize: 0,
        maxPoolSize: 200,
        waitQueueTimeoutMS: 5000,
        writeConcern: { journal: true, w: 'majority', wtimeoutMS: 5000 }
    }
}

export class MongoConnection implements OnModuleDestroy {
    constructor(
        readonly client: MongoClient,
        readonly db: Db,
        private readonly ownsClient = true
    ) {}

    static async connect(options: MongoConnectionOptions): Promise<MongoConnection> {
        const client = new MongoClient(options.uri, createMongoDriverOptions(options))
        try {
            await client.connect()
        } catch (error) {
            await client.close().catch(() => undefined)
            throw error
        }
        return new MongoConnection(client, client.db(options.dbName))
    }

    async ping(): Promise<void> {
        await this.db.command({ ping: 1 })
    }

    async onModuleDestroy() {
        if (this.ownsClient) await this.client.close()
    }
}
