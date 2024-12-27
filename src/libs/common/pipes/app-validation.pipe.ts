import { BadRequestException, ValidationPipe } from '@nestjs/common'

export class AppValidationPipe extends ValidationPipe {
    constructor() {
        super({
            exceptionFactory: (errors) =>
                new BadRequestException({
                    code: 'ERR_VALIDATION_FAILED',
                    message: 'Validation failed',
                    details: errors.map((error) => ({
                        field: error.property,
                        constraints: error.constraints
                    }))
                }),
            enableDebugMessages: false,
            disableErrorMessages: false,
            whitelist: true,
            forbidNonWhitelisted: true,
            skipMissingProperties: false,
            forbidUnknownValues: true,
            transform: true,
            transformOptions: {
                enableImplicitConversion: true
            }
        })
    }
}
