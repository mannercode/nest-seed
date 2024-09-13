import { Module, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'

@Module({
    providers: [
        {
            provide: APP_PIPE,
            useFactory: () =>
                new ValidationPipe({
                    enableDebugMessages: false, // Changing it to true doesn't make any difference.
                    disableErrorMessages: false,
                    whitelist: true, // Properties without decorators will be removed.
                    forbidNonWhitelisted: true,
                    skipMissingProperties: false, // If set to true, the validator will skip validation of all properties that are null or undefined in the validation object.
                    forbidUnknownValues: true // Default value, any attempt to validate an unknown object will fail immediately.
                })
        }
    ]
})
export class FilterModule {}
