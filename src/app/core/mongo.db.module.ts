import { Module } from '@nestjs/common'
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose'
import { generateUUID } from 'common'
import { AppConfigService, isEnv } from 'config'

@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: async (config: AppConfigService) => {
                const { user, pass, host1, host2, port, replica, database } = config.mongo
                const uri = `mongodb://${user}:${pass}@${host1}:${port},${host2}:${port}/?replicaSet=${replica}`
                const dbName = isEnv('test') ? 'test_' + generateUUID() : database

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
                    autoIndex: !isEnv('production'),
                    autoCreate: false
                } as MongooseModuleFactoryOptions
            },
            inject: [AppConfigService]
        })
    ]
})
export class MongoDbModule {}
