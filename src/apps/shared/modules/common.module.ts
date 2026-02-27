import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import { ScheduleModule } from '@nestjs/schedule'
import {
    AppLoggerService,
    ClientProxyModule,
    createWinstonLogger,
    ExceptionLoggerFilter,
    SuccessLoggerInterceptor
} from 'common'
import { AppConfigService, getProjectId } from '../config'
import { RequestValidationPipe } from '../pipes/request-validation.pipe'

@Global()
@Module({
    exports: [AppConfigService, ClientProxyModule],
    imports: [
        ConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationOptions: { abortEarly: false },
            validationSchema: AppConfigService.schema
        }),
        ClientProxyModule.registerAsync({
            inject: [AppConfigService],
            useFactory: (config: AppConfigService) => ({
                options: { queue: getProjectId(), servers: config.nats.servers },
                transport: Transport.NATS
            })
        }),
        ScheduleModule.forRoot()
    ],
    providers: [
        AppConfigService,
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: ExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: SuccessLoggerInterceptor },
        {
            inject: [AppConfigService],
            provide: AppLoggerService,
            useFactory: async ({ log }: AppConfigService) => {
                const logger = createWinstonLogger(log)
                return new AppLoggerService(logger)
            }
        }
    ]
})
export class CommonModule {}
