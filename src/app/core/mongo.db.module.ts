import { Module } from '@nestjs/common'
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose'
import { AppConfigService, isEnv } from 'config'
import { Connection } from 'mongoose'

@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: async (config: AppConfigService) => {
                const { user, pass, host1, host2, port, replica, database } = config.mongo
                const uri = `mongodb://${user}:${pass}@${host1}:${port},${host2}:${port}/?replicaSet=${replica}`
                const uniqueId = (global as any).JEST_UNIQUE_ID
                const dbName = isEnv('development') && uniqueId ? 'test_' + uniqueId : database

                return {
                    uri,
                    dbName,
                    waitQueueTimeoutMS: 5000,
                    writeConcern: {
                        w: 'majority',
                        journal: true,
                        wtimeoutMS: 5000
                    },
                    bufferCommands: true,
                    autoIndex: isEnv('development'),
                    autoCreate: false,
                    connectionFactory: async (connection: Connection) => {
                        if (isEnv('development')) {
                            await connection.dropDatabase()
                        }

                        return connection
                    }
                } as MongooseModuleFactoryOptions
            },
            inject: [AppConfigService]
        })
    ]
})
export class MongoDbModule {}
