import { BadRequestException, ValidationPipe } from '@nestjs/common'

export const RequestValidationPipeErrors = {
    Failed: { code: 'ERR_REQUEST_VALIDATION_FAILED', message: 'Validation failed' }
}

export class RequestValidationPipe extends ValidationPipe {
    constructor() {
        super({
            disableErrorMessages: false,
            enableDebugMessages: false,
            exceptionFactory: (errors) =>
                new BadRequestException({
                    ...RequestValidationPipeErrors.Failed,
                    details: errors.map((error) => ({
                        constraints: error.constraints,
                        field: error.property
                    }))
                }),
            forbidNonWhitelisted: true,
            forbidUnknownValues: true,
            skipMissingProperties: false,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
            whitelist: true
        })
    }
}
