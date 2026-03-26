import {
    AppLoggerService,
    createWinstonLogger,
    ExceptionLoggerFilter,
    SuccessLoggerInterceptor
} from '@mannercode/common'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigService } from '../config'
import { RequestValidationPipe } from '../pipes/request-validation.pipe'

@Global()
@Module({
    exports: [AppConfigService],
    imports: [
        ConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationOptions: { abortEarly: false },
            validationSchema: AppConfigService.schema
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
