import { Module } from '@nestjs/common'
import { MongooseModule as NestMongooseModule } from '@nestjs/mongoose'
import { generateShortId } from 'common'
import { AppConfigService, isTest, MongooseConfig } from 'config'

@Module({
    imports: [
        NestMongooseModule.forRootAsync({
            connectionName: MongooseConfig.connName,
            useFactory: async (config: AppConfigService) => {
                const { user, password, host1, host2, host3, port, replica, database } =
                    config.mongo
                const uri = `mongodb://${user}:${password}@${host1}:${port},${host2}:${port},${host3}:${port}/?replicaSet=${replica}`
                const dbName = isTest() ? 'test_' + generateShortId() : database

                return {
                    uri,
                    dbName,
                    waitQueueTimeoutMS: 5000,
                    writeConcern: { w: 'majority', journal: true, wtimeoutMS: 5000 },
                    bufferCommands: true,
                    autoIndex: false,
                    autoCreate: false
                }
            },
            inject: [AppConfigService]
        })
    ]
})
export class MongooseModule {}
