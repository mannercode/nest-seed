import { Module } from '@nestjs/common'
import { MongooseModule, MongooseModuleFactoryOptions } from '@nestjs/mongoose'
import { matchesEnv, mongoDataSource } from 'config'
import { Connection } from 'mongoose'

@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: () =>
                ({
                    ...mongoDataSource(),
                    waitQueueTimeoutMS: 5000,
                    writeConcern: {
                        w: 'majority',
                        journal: true,
                        wtimeoutMS: 5000
                    },
                    bufferCommands: true,
                    autoIndex: matchesEnv('development'),
                    autoCreate: false,
                    connectionFactory: async (connection: Connection) => {
                        if (matchesEnv('development')) {
                            await connection.dropDatabase()
                        }

                        return connection
                    }
                }) as MongooseModuleFactoryOptions
        })
    ]
})
export class MongoDbModule {}
