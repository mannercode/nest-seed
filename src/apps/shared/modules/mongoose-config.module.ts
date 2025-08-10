import { Module } from '@nestjs/common'
import { getConnectionToken, MongooseModule } from '@nestjs/mongoose'
import { SchemaOptions } from 'mongoose'
import { AppConfigService } from '../config'

@Module({
    imports: [
        MongooseModule.forRootAsync({
            connectionName: MongooseConfigModule.connectionName,
            useFactory: async (config: AppConfigService) => {
                const { user, password, host1, host2, host3, replica, database } = config.mongo

                return {
                    uri: `mongodb://${user}:${password}@${host1},${host2},${host3}/?replicaSet=${replica}`,
                    dbName: database,
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
export class MongooseConfigModule {
    static get moduleName() {
        return getConnectionToken(this.connectionName)
    }

    static get connectionName() {
        return 'mongo-connection'
    }

    static schemaOptions: SchemaOptions = {
        // https://mongoosejs.com/docs/guide.html#optimisticConcurrency
        optimisticConcurrency: true,
        minimize: false,
        strict: 'throw',
        strictQuery: 'throw',
        timestamps: true,
        validateBeforeSave: true,
        toJSON: { virtuals: true, flattenObjectIds: true, versionKey: false }
    }

    static get maxTake() {
        return 50
    }
}
