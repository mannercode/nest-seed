import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { Transport } from '@nestjs/microservices'
import {
    AppLoggerService,
    ClientProxyModule,
    createWinstonLogger,
    ExceptionLoggerFilter,
    Path,
    SuccessLoggingInterceptor
} from 'common'
import { AppConfigService, getProjectId } from '../config'
import { RequestValidationPipe } from '../pipes/request-validation.pipe'
import { ScheduleModule } from '@nestjs/schedule'
import { exit } from 'process'

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
        }),
        ScheduleModule.forRoot()
    ],
    providers: [
        AppConfigService,
        { provide: APP_PIPE, useClass: RequestValidationPipe },
        { provide: APP_FILTER, useClass: ExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: SuccessLoggingInterceptor },
        {
            provide: AppLoggerService,
            useFactory: async ({ log }: AppConfigService) => {
                if (!(await Path.isWritable(log.directory))) {
                    console.error(`Error: Directory is not writable: '${log.directory}'`)
                    exit(1)
                }

                const logger = createWinstonLogger(log)
                return new AppLoggerService(logger)
            },
            inject: [AppConfigService]
        }
    ],
    exports: [AppConfigService, ClientProxyModule]
})
export class CommonModule {}
