import {
    AppLoggerService,
    createWinstonLogger,
    HttpExceptionLoggerFilter,
    HttpSuccessLoggerInterceptor
} from '@mannercode/common'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigService } from '../config'
import { RequestValidationPipe } from '../pipes'

@Global()
@Module({
    exports: [AppConfigService, JwtModule],
    imports: [
        JwtModule.register({}),
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
        { provide: APP_FILTER, useClass: HttpExceptionLoggerFilter },
        { provide: APP_INTERCEPTOR, useClass: HttpSuccessLoggerInterceptor },
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
