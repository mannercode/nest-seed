import type { OnModuleDestroy } from '@nestjs/common'
import { MongoClient, type Db, type MongoClientOptions } from 'mongodb'

export type MongoConnectionOptions = {
    uri: string
    dbName: string
    appName?: string
    lifetime: 'application' | 'test-file'
}

export function createMongoDriverOptions({
    appName,
    lifetime
}: Pick<MongoConnectionOptions, 'appName' | 'lifetime'>): MongoClientOptions {
    return {
        appName,
        // 프로세스 수명의 연결만 idle capacity를 유지한다. 테스트 파일은 hook이 수명을 제한한다.
        minPoolSize: lifetime === 'application' ? 50 : 0,
        maxPoolSize: 200,
        waitQueueTimeoutMS: lifetime === 'application' ? 5000 : 0,
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
