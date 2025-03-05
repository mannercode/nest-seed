import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Transport } from '@nestjs/microservices'
import { AppLoggerService, ClientProxyModule, createWinstonLogger } from 'common'
import { AppConfigService, ClientProxyConfig, configSchema, ProjectName } from '../config'

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationSchema: configSchema,
            validationOptions: { abortEarly: false }
        }),
        ClientProxyModule.registerAsync({
            name: ClientProxyConfig.connName,
            useFactory: async (config: AppConfigService) => {
                const { servers } = config.nats
                return {
                    transport: Transport.NATS,
                    options: { servers, queue: ProjectName }
                }
            },
            inject: [AppConfigService]
        })
    ],
    providers: [
        AppConfigService,
        {
            provide: AppLoggerService,
            useFactory: async (config: AppConfigService) => {
                const loggerInstance = await createWinstonLogger(config.log)
                return new AppLoggerService(loggerInstance)
            },
            inject: [AppConfigService]
        }
    ],
    exports: [AppConfigService, ClientProxyModule]
})
export class CommonConfigModule {}
