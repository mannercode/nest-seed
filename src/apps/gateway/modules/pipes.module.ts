import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import {
    AppValidationPipe,
    HttpErrorFilter,
    HttpExceptionFilter,
    HttpSuccessInterceptor,
    RpcToHttpExceptionInterceptor
} from 'common'

@Module({
    providers: [
        {
            provide: APP_PIPE,
            useClass: AppValidationPipe
        },
        {
            provide: APP_FILTER,
            useClass: HttpErrorFilter
        },
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: HttpSuccessInterceptor
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: RpcToHttpExceptionInterceptor
        }
    ]
})
export class PipesModule {}
