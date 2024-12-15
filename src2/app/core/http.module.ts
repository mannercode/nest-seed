import { BadRequestException, Module, ValidationPipe } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { HttpErrorFilter, HttpExceptionFilter, HttpSuccessInterceptor } from 'common'

@Module({
    providers: [
        {
            provide: APP_PIPE,
            useFactory: () =>
                new ValidationPipe({
                    exceptionFactory: (errors) =>
                        new BadRequestException({
                            code: 'ERR_VALIDATION_FAILED',
                            message: 'Validation failed',
                            details: errors.map((error) => ({
                                field: error.property,
                                constraints: error.constraints
                            }))
                        }),
                    enableDebugMessages: false, // Changing it to true doesn't make any difference.
                    disableErrorMessages: false,
                    whitelist: true, // Properties without decorators will be removed.
                    forbidNonWhitelisted: true,
                    skipMissingProperties: false, // If set to true, the validator will skip validation of all properties that are null or undefined in the validation object.
                    forbidUnknownValues: true, // Default value, any attempt to validate an unknown object will fail immediately.
                    transform: true,
                    transformOptions: {
                        enableImplicitConversion: true // Setting it to false will cause an error in @InInt().
                    }
                })
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
        }
    ]
})
export class HttpModule {}
