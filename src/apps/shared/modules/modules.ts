import { RedisModule, RedisModuleOptions } from '@nestjs-modules/ioredis'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Transport } from '@nestjs/microservices'
import { MongooseModule } from '@nestjs/mongoose'
import { AppLoggerService, ClientProxyModule, initializeLogger, LoggerConfiguration } from 'common'
import {
    AppConfigService,
    ClientProxyConfig,
    configSchema,
    MongooseConfig,
    ProjectName,
    RedisConfig,
    uniqueWhenTesting
} from '../config'

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationSchema: configSchema,
            validationOptions: { abortEarly: false }
        }),
        MongooseModule.forRootAsync({
            connectionName: MongooseConfig.connName,
            useFactory: async (config: AppConfigService) => {
                const { user, password, host1, host2, host3, port, replica, database } =
                    config.mongo
                const uri = `mongodb://${user}:${password}@${host1}:${port},${host2}:${port},${host3}:${port}/?replicaSet=${replica}`
                const dbName = uniqueWhenTesting(database)

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
        }),
        RedisModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => {
                    const { nodes, password } = config.redis

                    let redisOptions: RedisModuleOptions = {
                        type: 'cluster',
                        nodes,
                        options: { redisOptions: { password }, enableOfflineQueue: false }
                    }

                    return redisOptions
                },
                inject: [AppConfigService]
            },
            RedisConfig.connName
        ),
        ClientProxyModule.registerAsync({
            name: ClientProxyConfig.connName,
            useFactory: async (config: AppConfigService) => {
                const { servers } = config.nats
                return { transport: Transport.NATS, options: { servers, queue: ProjectName } }
            },
            inject: [AppConfigService]
        })
    ],
    providers: [
        {
            provide: AppLoggerService,
            useFactory: async (config: AppConfigService) => {
                const loggerInstance = await initializeLogger(config.log as LoggerConfiguration)

                return new AppLoggerService(loggerInstance)
            },
            inject: [AppConfigService]
        },
        AppConfigService
    ],
    exports: [AppConfigService]
})
export class SharedModules {}
