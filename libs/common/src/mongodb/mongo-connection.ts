import type { OnModuleDestroy } from '@nestjs/common'
import { MongoClient, type Db, type MongoClientOptions } from 'mongodb'

export type MongoConnectionOptions = {
    uri: string
    dbName: string
    appName?: string
    minPoolSize?: number
}

export function createMongoDriverOptions({
    appName,
    minPoolSize = 0
}: Pick<MongoConnectionOptions, 'appName' | 'minPoolSize'>): MongoClientOptions {
    return {
        appName,
        minPoolSize,
        maxPoolSize: 200,
        waitQueueTimeoutMS: 5000,
        writeConcern: { journal: true, w: 'majority', wtimeoutMS: 60000 }
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
        const db = client.db(options.dbName)
        await using setup = new AsyncDisposableStack()
        setup.defer(() => client.close())
        await client.connect()
        setup.move()
        return new MongoConnection(client, db)
    }

    async ping(): Promise<void> {
        await this.db.command({ ping: 1 })
    }

    async onModuleDestroy() {
        if (this.ownsClient) await this.client.close()
    }
}
