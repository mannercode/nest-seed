import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import {
    AppLoggerService,
    ClientProxyModule,
    createWinstonLogger,
    ExceptionLoggerFilter,
    SuccessLoggingInterceptor
} from 'common'
import { AppConfigService, getProjectId } from '../config'
import { RequestValidationPipe } from '../pipes/request-validation.pipe'

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationSchema: AppConfigService.schema,
            validationOptions: { abortEarly: false }
        }),
        ClientProxyModule.registerAsync({
            useFactory: (config: AppConfigService) => {
                return {
                    transport: Transport.NATS,
                    options: { servers: config.nats.servers, queue: getProjectId() }
                }
            },
            inject: [AppConfigService]
        })
    ],
    providers: [
        AppConfigService,
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: ExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: SuccessLoggingInterceptor },
        {
            provide: AppLoggerService,
            useFactory: (config: AppConfigService) => {
                const loggerInstance = createWinstonLogger(config.log)
                return new AppLoggerService(loggerInstance)
            },
            inject: [AppConfigService]
        }
    ],
    exports: [AppConfigService, ClientProxyModule]
})
export class CommonModule {}
