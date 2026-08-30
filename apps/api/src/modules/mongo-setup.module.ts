import { Module } from '@nestjs/common'
import { MongoClient } from 'mongodb'
import { AppConfigService, createMongoDriverOptions, MongoConnection } from '#config'

@Module({
    exports: [MongoConnection],
    providers: [
        {
            inject: [AppConfigService],
            provide: MongoConnection,
            useFactory: async (config: AppConfigService) => {
                const { uri, dbName } = config.mongo
                const client = new MongoClient(
                    uri,
                    createMongoDriverOptions({ lifetime: 'application' })
                )

                try {
                    await client.connect()
                } catch (error) {
                    await client.close().catch(() => undefined)
                    throw error
                }

                return new MongoConnection(client, client.db(dbName))
            }
        }
    ]
})
export class MongoSetupModule {}
