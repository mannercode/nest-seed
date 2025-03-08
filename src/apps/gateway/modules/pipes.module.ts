import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { AppValidationPipe, HttpExceptionFilter, HttpSuccessInterceptor } from 'common'

@Module({
    providers: [
        {
            provide: APP_PIPE,
            useClass: AppValidationPipe
        },
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: HttpSuccessInterceptor
        }
    ]
})
export class PipesModule {}
